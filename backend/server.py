from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix, cohen_kappa_score
from scipy import stats
import io
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Bioinformatics Amplification Comparison API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Statistical Functions
def calculate_diagnostic_stats(TP: int, TN: int, FP: int, FN: int, confidence_level: float = 0.95):
    """Calculate diagnostic statistics with confidence intervals"""
    
    # Basic calculations
    total = TP + TN + FP + FN
    if total == 0:
        raise ValueError("No data provided")
    
    # Calculate metrics
    sensitivity = TP / (TP + FN) if (TP + FN) > 0 else 0
    specificity = TN / (TN + FP) if (TN + FP) > 0 else 0
    ppv = TP / (TP + FP) if (TP + FP) > 0 else 0
    npv = TN / (TN + FN) if (TN + FN) > 0 else 0
    accuracy = (TP + TN) / total
    prevalence = (TP + FN) / total
    
    # Calculate confidence intervals using Wilson Score Interval
    alpha = 1 - confidence_level
    z = stats.norm.ppf(1 - alpha/2)
    
    def wilson_ci(x, n):
        if n == 0:
            return (0, 0)
        p = x / n
        denominator = 1 + z**2/n
        centre = (p + z**2/(2*n)) / denominator
        margin = z * np.sqrt((p*(1-p) + z**2/(4*n)) / n) / denominator
        return (max(0, centre - margin), min(1, centre + margin))
    
    # Calculate CIs
    sens_ci = wilson_ci(TP, TP + FN)
    spec_ci = wilson_ci(TN, TN + FP)
    ppv_ci = wilson_ci(TP, TP + FP)
    npv_ci = wilson_ci(TN, TN + FN)
    acc_ci = wilson_ci(TP + TN, total)
    
    return {
        'sensitivity': {
            'value': sensitivity,
            'ci_lower': sens_ci[0],
            'ci_upper': sens_ci[1]
        },
        'specificity': {
            'value': specificity,
            'ci_lower': spec_ci[0],
            'ci_upper': spec_ci[1]
        },
        'ppv': {
            'value': ppv,
            'ci_lower': ppv_ci[0],
            'ci_upper': ppv_ci[1]
        },
        'npv': {
            'value': npv,
            'ci_lower': npv_ci[0],
            'ci_upper': npv_ci[1]
        },
        'accuracy': {
            'value': accuracy,
            'ci_lower': acc_ci[0],
            'ci_upper': acc_ci[1]
        },
        'prevalence': prevalence,
        'confusion_matrix': {
            'TP': TP,
            'TN': TN,
            'FP': FP,
            'FN': FN
        }
    }

def calculate_cohens_kappa(y_true: List, y_pred: List, confidence_level: float = 0.95):
    """Calculate Cohen's Kappa with confidence interval"""
    
    if len(y_true) != len(y_pred):
        raise ValueError("Arrays must have the same length")
    
    # Calculate kappa
    kappa = cohen_kappa_score(y_true, y_pred)
    
    # Calculate confidence interval (asymptotic method)
    n = len(y_true)
    conf_matrix = confusion_matrix(y_true, y_pred)
    
    # Observed agreement
    po = np.trace(conf_matrix) / n
    
    # Expected agreement
    marginal_row = np.sum(conf_matrix, axis=1) / n
    marginal_col = np.sum(conf_matrix, axis=0) / n
    pe = np.sum(marginal_row * marginal_col)
    
    # Standard error calculation (simplified)
    se = np.sqrt((po * (1 - po)) / (n * (1 - pe)**2))
    
    # Confidence interval
    alpha = 1 - confidence_level
    z = stats.norm.ppf(1 - alpha/2)
    ci_lower = kappa - z * se
    ci_upper = kappa + z * se
    
    # Interpretation
    interpretation = ""
    if kappa < 0:
        interpretation = "Poor agreement (worse than chance)"
    elif kappa < 0.20:
        interpretation = "Slight agreement"
    elif kappa < 0.40:
        interpretation = "Fair agreement"
    elif kappa < 0.60:
        interpretation = "Moderate agreement"
    elif kappa < 0.80:
        interpretation = "Substantial agreement"
    else:
        interpretation = "Almost perfect agreement"
    
    return {
        'kappa': kappa,
        'ci_lower': ci_lower,
        'ci_upper': ci_upper,
        'interpretation': interpretation,
        'observed_agreement': po,
        'expected_agreement': pe,
        'sample_size': n
    }

# Pydantic Models
class ExperimentData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technique_name: str
    true_positives: int = Field(ge=0)
    true_negatives: int = Field(ge=0)
    false_positives: int = Field(ge=0)
    false_negatives: int = Field(ge=0)
    confidence_level: float = Field(default=0.95, ge=0.5, le=0.99)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExperimentDataCreate(BaseModel):
    technique_name: str
    true_positives: int = Field(ge=0)
    true_negatives: int = Field(ge=0)
    false_positives: int = Field(ge=0)
    false_negatives: int = Field(ge=0)
    confidence_level: float = Field(default=0.95, ge=0.5, le=0.99)

class DiagnosticResults(BaseModel):
    experiment_id: str
    technique_name: str
    sensitivity: Dict[str, float]
    specificity: Dict[str, float]
    ppv: Dict[str, float]
    npv: Dict[str, float]
    accuracy: Dict[str, float]
    prevalence: float
    confusion_matrix: Dict[str, int]
    confidence_level: float
    timestamp: datetime

class KappaRequest(BaseModel):
    rater1_data: List[Union[str, int]]
    rater2_data: List[Union[str, int]]
    confidence_level: float = Field(default=0.95, ge=0.5, le=0.99)
    description: Optional[str] = None

class KappaResults(BaseModel):
    kappa: float
    ci_lower: float
    ci_upper: float
    interpretation: str
    observed_agreement: float
    expected_agreement: float
    sample_size: int
    confidence_level: float
    description: Optional[str] = None

class ComparisonRequest(BaseModel):
    experiment_ids: List[str]

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Bioinformatics Amplification Comparison API"}

@api_router.post("/experiments", response_model=DiagnosticResults)
async def create_experiment(data: ExperimentDataCreate):
    """Create a new experiment and calculate diagnostic statistics"""
    try:
        # Create experiment record
        experiment = ExperimentData(**data.dict())
        
        # Calculate diagnostic statistics
        stats_result = calculate_diagnostic_stats(
            TP=data.true_positives,
            TN=data.true_negatives,
            FP=data.false_positives,
            FN=data.false_negatives,
            confidence_level=data.confidence_level
        )
        
        # Create results object
        results = DiagnosticResults(
            experiment_id=experiment.id,
            technique_name=experiment.technique_name,
            sensitivity=stats_result['sensitivity'],
            specificity=stats_result['specificity'],
            ppv=stats_result['ppv'],
            npv=stats_result['npv'],
            accuracy=stats_result['accuracy'],
            prevalence=stats_result['prevalence'],
            confusion_matrix=stats_result['confusion_matrix'],
            confidence_level=experiment.confidence_level,
            timestamp=experiment.timestamp
        )
        
        # Store in database
        await db.experiments.insert_one(experiment.dict())
        await db.results.insert_one(results.dict())
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/experiments", response_model=List[DiagnosticResults])
async def get_experiments():
    """Get all experiment results"""
    try:
        results = await db.results.find().to_list(1000)
        return [DiagnosticResults(**result) for result in results]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/experiments/{experiment_id}", response_model=DiagnosticResults)
async def get_experiment(experiment_id: str):
    """Get specific experiment results"""
    try:
        result = await db.results.find_one({"experiment_id": experiment_id})
        if not result:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return DiagnosticResults(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/kappa", response_model=KappaResults)
async def calculate_kappa(data: KappaRequest):
    """Calculate Cohen's Kappa statistic"""
    try:
        kappa_result = calculate_cohens_kappa(
            y_true=data.rater1_data,
            y_pred=data.rater2_data,
            confidence_level=data.confidence_level
        )
        
        results = KappaResults(
            kappa=kappa_result['kappa'],
            ci_lower=kappa_result['ci_lower'],
            ci_upper=kappa_result['ci_upper'],
            interpretation=kappa_result['interpretation'],
            observed_agreement=kappa_result['observed_agreement'],
            expected_agreement=kappa_result['expected_agreement'],
            sample_size=kappa_result['sample_size'],
            confidence_level=data.confidence_level,
            description=data.description
        )
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/upload-data")
async def upload_experiment_data(file: UploadFile = File(...)):
    """Upload CSV/Excel file with experiment data"""
    try:
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
        
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Validate required columns
        required_columns = ['technique_name', 'true_positives', 'true_negatives', 'false_positives', 'false_negatives']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Process each row
        results = []
        for _, row in df.iterrows():
            try:
                # Create experiment data
                exp_data = ExperimentDataCreate(
                    technique_name=str(row['technique_name']),
                    true_positives=int(row['true_positives']),
                    true_negatives=int(row['true_negatives']),
                    false_positives=int(row['false_positives']),
                    false_negatives=int(row['false_negatives']),
                    confidence_level=float(row.get('confidence_level', 0.95))
                )
                
                # Create experiment record
                experiment = ExperimentData(**exp_data.dict())
                
                # Calculate diagnostic statistics
                stats_result = calculate_diagnostic_stats(
                    TP=exp_data.true_positives,
                    TN=exp_data.true_negatives,
                    FP=exp_data.false_positives,
                    FN=exp_data.false_negatives,
                    confidence_level=exp_data.confidence_level
                )
                
                # Create results object
                result = DiagnosticResults(
                    experiment_id=experiment.id,
                    technique_name=experiment.technique_name,
                    sensitivity=stats_result['sensitivity'],
                    specificity=stats_result['specificity'],
                    ppv=stats_result['ppv'],
                    npv=stats_result['npv'],
                    accuracy=stats_result['accuracy'],
                    prevalence=stats_result['prevalence'],
                    confusion_matrix=stats_result['confusion_matrix'],
                    confidence_level=experiment.confidence_level,
                    timestamp=experiment.timestamp
                )
                
                # Store in database
                await db.experiments.insert_one(experiment.dict())
                await db.results.insert_one(result.dict())
                
                results.append(result)
                
            except Exception as row_error:
                logger.warning(f"Skipping row due to error: {row_error}")
                continue
        
        return {
            "message": f"Successfully processed {len(results)} experiments",
            "results": [result.dict() for result in results]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@api_router.post("/compare")
async def compare_techniques(request: ComparisonRequest):
    """Compare multiple amplification techniques"""
    try:
        # Get results for all requested experiments
        results = []
        for exp_id in request.experiment_ids:
            result = await db.results.find_one({"experiment_id": exp_id})
            if result:
                results.append(DiagnosticResults(**result))
        
        if not results:
            raise HTTPException(status_code=404, detail="No experiments found")
        
        # Create comparison summary
        comparison = {
            "techniques": [],
            "summary": {
                "best_sensitivity": None,
                "best_specificity": None,
                "best_accuracy": None,
                "best_ppv": None,
                "best_npv": None
            }
        }
        
        best_metrics = {
            "sensitivity": {"value": -1, "technique": ""},
            "specificity": {"value": -1, "technique": ""},
            "accuracy": {"value": -1, "technique": ""},
            "ppv": {"value": -1, "technique": ""},
            "npv": {"value": -1, "technique": ""}
        }
        
        for result in results:
            technique_data = {
                "technique_name": result.technique_name,
                "experiment_id": result.experiment_id,
                "metrics": {
                    "sensitivity": result.sensitivity,
                    "specificity": result.specificity,
                    "accuracy": result.accuracy,
                    "ppv": result.ppv,
                    "npv": result.npv
                },
                "prevalence": result.prevalence,
                "confusion_matrix": result.confusion_matrix
            }
            comparison["techniques"].append(technique_data)
            
            # Track best performing techniques
            for metric in best_metrics:
                if result.__dict__[metric]["value"] > best_metrics[metric]["value"]:
                    best_metrics[metric]["value"] = result.__dict__[metric]["value"]
                    best_metrics[metric]["technique"] = result.technique_name
        
        comparison["summary"] = {
            "best_sensitivity": {"technique": best_metrics["sensitivity"]["technique"], "value": best_metrics["sensitivity"]["value"]},
            "best_specificity": {"technique": best_metrics["specificity"]["technique"], "value": best_metrics["specificity"]["value"]},
            "best_accuracy": {"technique": best_metrics["accuracy"]["technique"], "value": best_metrics["accuracy"]["value"]},
            "best_ppv": {"technique": best_metrics["ppv"]["technique"], "value": best_metrics["ppv"]["value"]},
            "best_npv": {"technique": best_metrics["npv"]["technique"], "value": best_metrics["npv"]["value"]}
        }
        
        return comparison
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()