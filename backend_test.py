import requests
import sys
import json
from datetime import datetime

class BioinformaticsAPITester:
    def __init__(self, base_url="https://pcr-diagnostic.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.experiment_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else f"{self.api_url}/"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_create_experiment(self, technique_name, tp, tn, fp, fn, confidence_level=0.95):
        """Test creating an experiment"""
        data = {
            "technique_name": technique_name,
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "confidence_level": confidence_level
        }
        
        success, response = self.run_test(
            f"Create Experiment - {technique_name}",
            "POST",
            "experiments",
            200,
            data=data
        )
        
        if success and 'experiment_id' in response:
            self.experiment_ids.append(response['experiment_id'])
            print(f"   Experiment ID: {response['experiment_id']}")
            
            # Validate response structure
            required_fields = ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy', 'prevalence', 'confusion_matrix']
            for field in required_fields:
                if field not in response:
                    print(f"   ⚠️  Missing field: {field}")
                    return False
            
            # Check if metrics have confidence intervals
            for metric in ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy']:
                if 'value' not in response[metric] or 'ci_lower' not in response[metric] or 'ci_upper' not in response[metric]:
                    print(f"   ⚠️  Missing CI data for {metric}")
                    return False
            
            print(f"   Sensitivity: {response['sensitivity']['value']:.3f} ({response['sensitivity']['ci_lower']:.3f}-{response['sensitivity']['ci_upper']:.3f})")
            print(f"   Specificity: {response['specificity']['value']:.3f} ({response['specificity']['ci_lower']:.3f}-{response['specificity']['ci_upper']:.3f})")
            
        return success

    def test_get_experiments(self):
        """Test getting all experiments"""
        success, response = self.run_test("Get All Experiments", "GET", "experiments", 200)
        
        if success:
            print(f"   Found {len(response)} experiments")
            if len(response) > 0:
                print(f"   First experiment technique: {response[0].get('technique_name', 'Unknown')}")
        
        return success

    def test_get_specific_experiment(self, experiment_id):
        """Test getting a specific experiment"""
        return self.run_test(
            f"Get Specific Experiment - {experiment_id[:8]}...",
            "GET",
            f"experiments/{experiment_id}",
            200
        )

    def test_cohens_kappa(self, rater1_data, rater2_data, confidence_level=0.95, description="Test kappa calculation"):
        """Test Cohen's Kappa calculation"""
        data = {
            "rater1_data": rater1_data,
            "rater2_data": rater2_data,
            "confidence_level": confidence_level,
            "description": description
        }
        
        success, response = self.run_test(
            "Cohen's Kappa Calculation",
            "POST",
            "kappa",
            200,
            data=data
        )
        
        if success:
            required_fields = ['kappa', 'ci_lower', 'ci_upper', 'interpretation', 'observed_agreement', 'expected_agreement', 'sample_size']
            for field in required_fields:
                if field not in response:
                    print(f"   ⚠️  Missing field: {field}")
                    return False
            
            print(f"   Kappa: {response['kappa']:.4f}")
            print(f"   Interpretation: {response['interpretation']}")
            print(f"   CI: {response['ci_lower']:.4f} - {response['ci_upper']:.4f}")
        
        return success

    def test_file_upload(self):
        """Test file upload functionality"""
        # Create a simple CSV content
        csv_content = """technique_name,true_positives,true_negatives,false_positives,false_negatives,confidence_level
qPCR Test,45,38,2,5,0.95
RPA Test,42,40,3,4,0.95"""
        
        files = {'file': ('test_data.csv', csv_content, 'text/csv')}
        
        success, response = self.run_test(
            "File Upload - CSV",
            "POST",
            "upload-data",
            200,
            files=files
        )
        
        if success:
            if 'results' in response:
                print(f"   Processed {len(response['results'])} experiments from file")
                # Store experiment IDs from file upload
                for result in response['results']:
                    if 'experiment_id' in result:
                        self.experiment_ids.append(result['experiment_id'])
            else:
                print(f"   ⚠️  No results field in response")
        
        return success

    def test_compare_techniques(self):
        """Test technique comparison"""
        if len(self.experiment_ids) < 2:
            print("⚠️  Need at least 2 experiments for comparison test")
            return False
        
        data = {
            "experiment_ids": self.experiment_ids[:2]  # Compare first 2 experiments
        }
        
        success, response = self.run_test(
            "Compare Techniques",
            "POST",
            "compare",
            200,
            data=data
        )
        
        if success:
            required_fields = ['techniques', 'summary']
            for field in required_fields:
                if field not in response:
                    print(f"   ⚠️  Missing field: {field}")
                    return False
            
            print(f"   Compared {len(response['techniques'])} techniques")
            if 'best_sensitivity' in response['summary']:
                print(f"   Best sensitivity: {response['summary']['best_sensitivity']['technique']}")
        
        return success

    def test_error_handling(self):
        """Test API error handling"""
        print("\n🔍 Testing Error Handling...")
        
        # Test invalid experiment creation
        invalid_data = {
            "technique_name": "",  # Empty technique name
            "true_positives": -1,  # Negative value
            "true_negatives": 10,
            "false_positives": 2,
            "false_negatives": 3
        }
        
        success, _ = self.run_test(
            "Invalid Experiment Data",
            "POST",
            "experiments",
            422,  # Validation error
            data=invalid_data
        )
        
        # Test non-existent experiment
        success2, _ = self.run_test(
            "Non-existent Experiment",
            "GET",
            "experiments/non-existent-id",
            404
        )
        
        # Test invalid kappa data
        invalid_kappa = {
            "rater1_data": [1, 2, 3],
            "rater2_data": [1, 2],  # Different length
            "confidence_level": 0.95
        }
        
        success3, _ = self.run_test(
            "Invalid Kappa Data",
            "POST",
            "kappa",
            400,
            data=invalid_kappa
        )
        
        return success or success2 or success3  # At least one error test should pass

def main():
    print("🧬 Bioinformatics API Testing Suite")
    print("=" * 50)
    
    tester = BioinformaticsAPITester()
    
    # Test basic connectivity
    if not tester.test_root_endpoint():
        print("❌ Cannot connect to API. Stopping tests.")
        return 1
    
    # Test experiment creation with different techniques
    test_experiments = [
        ("qPCR (Quantitative PCR)", 45, 38, 2, 5, 0.95),
        ("RPA (Recombinase Polymerase Amplification)", 42, 40, 3, 4, 0.95),
        ("LAMP (Loop-mediated Isothermal Amplification)", 48, 35, 1, 6, 0.99)
    ]
    
    for technique, tp, tn, fp, fn, conf in test_experiments:
        tester.test_create_experiment(technique, tp, tn, fp, fn, conf)
    
    # Test getting experiments
    tester.test_get_experiments()
    
    # Test getting specific experiment
    if tester.experiment_ids:
        tester.test_get_specific_experiment(tester.experiment_ids[0])
    
    # Test Cohen's Kappa
    tester.test_cohens_kappa(
        rater1_data=[1, 2, 1, 3, 2, 1, 3],
        rater2_data=[1, 1, 1, 3, 2, 2, 3],
        confidence_level=0.95,
        description="Inter-rater reliability test"
    )
    
    # Test file upload
    tester.test_file_upload()
    
    # Test technique comparison
    tester.test_compare_techniques()
    
    # Test error handling
    tester.test_error_handling()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())