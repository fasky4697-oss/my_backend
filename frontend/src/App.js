import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Upload, BarChart3, Calculator, Download, Plus, Trash2, FlaskConical, Dna, Microscope, Activity } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualData, setManualData] = useState({
    technique_name: "",
    true_positives: "",
    true_negatives: "",
    false_positives: "",
    false_negatives: "",
    confidence_level: "0.95"
  });
  const [kappaData, setKappaData] = useState({
    rater1_data: "",
    rater2_data: "",
    confidence_level: "0.95",
    description: ""
  });
  const [kappaResults, setKappaResults] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  
  const { toast } = useToast();

  const amplificationTechniques = [
    "qPCR (Quantitative PCR)",
    "RPA (Recombinase Polymerase Amplification)",
    "LAMP (Loop-mediated Isothermal Amplification)",
    "NASBA (Nucleic Acid Sequence-Based Amplification)",
    "SDA (Strand Displacement Amplification)",
    "TMA (Transcription-Mediated Amplification)",
    "HDA (Helicase-Dependent Amplification)",
    "NEAR (Nicking Enzyme Amplification Reaction)"
  ];

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      const response = await axios.get(`${API}/experiments`);
      setExperiments(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch experiments",
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...manualData,
        true_positives: parseInt(manualData.true_positives),
        true_negatives: parseInt(manualData.true_negatives),
        false_positives: parseInt(manualData.false_positives),
        false_negatives: parseInt(manualData.false_negatives),
        confidence_level: parseFloat(manualData.confidence_level)
      };
      
      await axios.post(`${API}/experiments`, data);
      
      toast({
        title: "Success",
        description: "Experiment created successfully",
      });
      
      setManualData({
        technique_name: "",
        true_positives: "",
        true_negatives: "",
        false_positives: "",
        false_negatives: "",
        confidence_level: "0.95"
      });
      
      fetchExperiments();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create experiment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API}/upload-data`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      toast({
        title: "Success",
        description: "File uploaded and processed successfully",
      });
      
      fetchExperiments();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKappaCalculation = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        rater1_data: kappaData.rater1_data.split(',').map(item => item.trim()),
        rater2_data: kappaData.rater2_data.split(',').map(item => item.trim()),
        confidence_level: parseFloat(kappaData.confidence_level),
        description: kappaData.description
      };
      
      const response = await axios.post(`${API}/kappa`, data);
      setKappaResults(response.data);
      
      toast({
        title: "Success",
        description: "Cohen's Kappa calculated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to calculate Kappa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComparison = async () => {
    if (selectedExperiments.length < 2) {
      toast({
        title: "Error",
        description: "Please select at least 2 experiments to compare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/compare`, {
        experiment_ids: selectedExperiments
      });
      setComparisonResults(response.data);
      
      toast({
        title: "Success",
        description: "Comparison completed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to compare techniques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExperimentSelection = (experimentId) => {
    setSelectedExperiments(prev => 
      prev.includes(experimentId) 
        ? prev.filter(id => id !== experimentId)
        : [...prev, experimentId]
    );
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatConfidenceInterval = (metric) => {
    return `${formatPercentage(metric.value)} (95% CI: ${formatPercentage(metric.ci_lower)} - ${formatPercentage(metric.ci_upper)})`;
  };

  const getMetricColor = (value) => {
    if (value >= 0.9) return "text-green-600";
    if (value >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-900 to-indigo-800 text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1576669801838-1b1c52121e6a')"
          }}
        />
        <div className="relative container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-600 rounded-full">
                <Dna size={48} />
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-6 font-serif">
              Nucleic Acid Amplification Analyzer
            </h1>
            <p className="text-xl mb-8 text-blue-100 leading-relaxed">
              Advanced statistical comparison of nucleic acid amplification techniques including qPCR, RPA, LAMP, and NASBA. 
              Calculate diagnostic statistics with confidence intervals and Cohen's Kappa for reliable method evaluation.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <FlaskConical size={20} />
                <span>Diagnostic Statistics</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 size={20} />
                <span>Statistical Comparison</span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator size={20} />
                <span>Cohen's Kappa</span>
              </div>
              <div className="flex items-center gap-2">
                <Microscope size={20} />
                <span>Laboratory Analysis</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="manual" className="text-sm font-medium">Manual Entry</TabsTrigger>
            <TabsTrigger value="upload" className="text-sm font-medium">File Upload</TabsTrigger>
            <TabsTrigger value="kappa" className="text-sm font-medium">Cohen's Kappa</TabsTrigger>
            <TabsTrigger value="results" className="text-sm font-medium">Results & Comparison</TabsTrigger>
          </TabsList>

          {/* Manual Data Entry Tab */}
          <TabsContent value="manual" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus size={20} />
                  Manual Data Entry
                </CardTitle>
                <CardDescription>
                  Enter experimental data manually for individual amplification technique analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="technique">Amplification Technique</Label>
                      <Select 
                        value={manualData.technique_name} 
                        onValueChange={(value) => setManualData({...manualData, technique_name: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select technique" />
                        </SelectTrigger>
                        <SelectContent>
                          {amplificationTechniques.map((technique) => (
                            <SelectItem key={technique} value={technique}>
                              {technique}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confidence">Confidence Level</Label>
                      <Select 
                        value={manualData.confidence_level} 
                        onValueChange={(value) => setManualData({...manualData, confidence_level: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.90">90%</SelectItem>
                          <SelectItem value="0.95">95%</SelectItem>
                          <SelectItem value="0.99">99%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tp">True Positives</Label>
                      <Input
                        id="tp"
                        type="number"
                        min="0"
                        value={manualData.true_positives}
                        onChange={(e) => setManualData({...manualData, true_positives: e.target.value})}
                        required
                        className="bg-green-50 border-green-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tn">True Negatives</Label>
                      <Input
                        id="tn"
                        type="number"
                        min="0"
                        value={manualData.true_negatives}
                        onChange={(e) => setManualData({...manualData, true_negatives: e.target.value})}
                        required
                        className="bg-green-50 border-green-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fp">False Positives</Label>
                      <Input
                        id="fp"
                        type="number"
                        min="0"
                        value={manualData.false_positives}
                        onChange={(e) => setManualData({...manualData, false_positives: e.target.value})}
                        required
                        className="bg-red-50 border-red-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fn">False Negatives</Label>
                      <Input
                        id="fn"
                        type="number"
                        min="0"
                        value={manualData.false_negatives}
                        onChange={(e) => setManualData({...manualData, false_negatives: e.target.value})}
                        required
                        className="bg-red-50 border-red-200"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Calculating..." : "Calculate Diagnostic Statistics"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload size={20} />
                  File Upload
                </CardTitle>
                <CardDescription>
                  Upload CSV or Excel files with experimental data for batch processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
                    <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">Upload Experiment Data</h3>
                    <p className="text-gray-500 mb-4">
                      Drag and drop your CSV or Excel file here, or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" asChild>
                        <span>Choose File</span>
                      </Button>
                    </label>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Required CSV/Excel Format:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Columns:</strong> technique_name, true_positives, true_negatives, false_positives, false_negatives</p>
                      <p><strong>Optional:</strong> confidence_level (default: 0.95)</p>
                      <p><strong>Example:</strong> qPCR,45,38,2,5,0.95</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cohen's Kappa Tab */}
          <TabsContent value="kappa" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator size={20} />
                  Cohen's Kappa Calculation
                </CardTitle>
                <CardDescription>
                  Calculate inter-rater reliability using Cohen's Kappa statistic with confidence intervals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleKappaCalculation} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="rater1">Rater 1 Data</Label>
                      <Input
                        id="rater1"
                        placeholder="1,2,1,3,2,1,3... (comma-separated)"
                        value={kappaData.rater1_data}
                        onChange={(e) => setKappaData({...kappaData, rater1_data: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rater2">Rater 2 Data</Label>
                      <Input
                        id="rater2"
                        placeholder="1,1,1,3,2,2,3... (comma-separated)"
                        value={kappaData.rater2_data}
                        onChange={(e) => setKappaData({...kappaData, rater2_data: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="kappa-confidence">Confidence Level</Label>
                      <Select 
                        value={kappaData.confidence_level} 
                        onValueChange={(value) => setKappaData({...kappaData, confidence_level: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.90">90%</SelectItem>
                          <SelectItem value="0.95">95%</SelectItem>
                          <SelectItem value="0.99">99%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        placeholder="e.g., Inter-rater reliability for qPCR results"
                        value={kappaData.description}
                        onChange={(e) => setKappaData({...kappaData, description: e.target.value})}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Calculating..." : "Calculate Cohen's Kappa"}
                  </Button>
                </form>

                {kappaResults && (
                  <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Cohen's Kappa Results</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Kappa Coefficient</Label>
                          <p className="text-2xl font-bold text-blue-600">{kappaResults.kappa.toFixed(4)}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">95% Confidence Interval</Label>
                          <p className="text-lg">{kappaResults.ci_lower.toFixed(4)} - {kappaResults.ci_upper.toFixed(4)}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Interpretation</Label>
                          <Badge variant="outline" className="mt-1">
                            {kappaResults.interpretation}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Observed Agreement</Label>
                          <p className="text-lg">{formatPercentage(kappaResults.observed_agreement)}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Expected Agreement</Label>
                          <p className="text-lg">{formatPercentage(kappaResults.expected_agreement)}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Sample Size</Label>
                          <p className="text-lg">{kappaResults.sample_size}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results & Comparison Tab */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={20} />
                  Experiment Results
                </CardTitle>
                <CardDescription>
                  View all experiment results and compare amplification techniques
                </CardDescription>
              </CardHeader>
              <CardContent>
                {experiments.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Select Experiments to Compare</h3>
                      <Button 
                        onClick={handleComparison} 
                        disabled={selectedExperiments.length < 2 || loading}
                        className="flex items-center gap-2"
                      >
                        <Activity size={16} />
                        Compare Selected ({selectedExperiments.length})
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Select</TableHead>
                            <TableHead>Technique</TableHead>
                            <TableHead>Sensitivity</TableHead>
                            <TableHead>Specificity</TableHead>
                            <TableHead>PPV</TableHead>
                            <TableHead>NPV</TableHead>
                            <TableHead>Accuracy</TableHead>
                            <TableHead>Prevalence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {experiments.map((exp) => (
                            <TableRow key={exp.experiment_id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedExperiments.includes(exp.experiment_id)}
                                  onChange={() => toggleExperimentSelection(exp.experiment_id)}
                                  className="w-4 h-4"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{exp.technique_name}</TableCell>
                              <TableCell className={getMetricColor(exp.sensitivity.value)}>
                                {formatConfidenceInterval(exp.sensitivity)}
                              </TableCell>
                              <TableCell className={getMetricColor(exp.specificity.value)}>
                                {formatConfidenceInterval(exp.specificity)}
                              </TableCell>
                              <TableCell className={getMetricColor(exp.ppv.value)}>
                                {formatConfidenceInterval(exp.ppv)}
                              </TableCell>
                              <TableCell className={getMetricColor(exp.npv.value)}>
                                {formatConfidenceInterval(exp.npv)}
                              </TableCell>
                              <TableCell className={getMetricColor(exp.accuracy.value)}>
                                {formatConfidenceInterval(exp.accuracy)}
                              </TableCell>
                              <TableCell>{formatPercentage(exp.prevalence)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {comparisonResults && (
                      <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
                        <h3 className="text-xl font-semibold mb-6">Technique Comparison Results</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                          <div className="text-center">
                            <Label className="text-sm font-medium">Best Sensitivity</Label>
                            <p className="text-lg font-semibold text-green-600">
                              {comparisonResults.summary.best_sensitivity.technique}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatPercentage(comparisonResults.summary.best_sensitivity.value)}
                            </p>
                          </div>
                          <div className="text-center">
                            <Label className="text-sm font-medium">Best Specificity</Label>
                            <p className="text-lg font-semibold text-blue-600">
                              {comparisonResults.summary.best_specificity.technique}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatPercentage(comparisonResults.summary.best_specificity.value)}
                            </p>
                          </div>
                          <div className="text-center">
                            <Label className="text-sm font-medium">Best Accuracy</Label>
                            <p className="text-lg font-semibold text-purple-600">
                              {comparisonResults.summary.best_accuracy.technique}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatPercentage(comparisonResults.summary.best_accuracy.value)}
                            </p>
                          </div>
                          <div className="text-center">
                            <Label className="text-sm font-medium">Best PPV</Label>
                            <p className="text-lg font-semibold text-orange-600">
                              {comparisonResults.summary.best_ppv.technique}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatPercentage(comparisonResults.summary.best_ppv.value)}
                            </p>
                          </div>
                          <div className="text-center">
                            <Label className="text-sm font-medium">Best NPV</Label>
                            <p className="text-lg font-semibold text-teal-600">
                              {comparisonResults.summary.best_npv.technique}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatPercentage(comparisonResults.summary.best_npv.value)}
                            </p>
                          </div>
                        </div>

                        <Separator className="my-6" />

                        <div className="space-y-6">
                          {comparisonResults.techniques.map((technique, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg border">
                              <h4 className="font-semibold mb-3">{technique.technique_name}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500">Sensitivity</Label>
                                  <div className="flex items-center gap-2">
                                    <Progress value={technique.metrics.sensitivity.value * 100} className="h-2" />
                                    <span className="text-sm font-medium">
                                      {formatPercentage(technique.metrics.sensitivity.value)}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">Specificity</Label>
                                  <div className="flex items-center gap-2">
                                    <Progress value={technique.metrics.specificity.value * 100} className="h-2" />
                                    <span className="text-sm font-medium">
                                      {formatPercentage(technique.metrics.specificity.value)}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">Accuracy</Label>
                                  <div className="flex items-center gap-2">
                                    <Progress value={technique.metrics.accuracy.value * 100} className="h-2" />
                                    <span className="text-sm font-medium">
                                      {formatPercentage(technique.metrics.accuracy.value)}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">PPV</Label>
                                  <div className="flex items-center gap-2">
                                    <Progress value={technique.metrics.ppv.value * 100} className="h-2" />
                                    <span className="text-sm font-medium">
                                      {formatPercentage(technique.metrics.ppv.value)}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">NPV</Label>
                                  <div className="flex items-center gap-2">
                                    <Progress value={technique.metrics.npv.value * 100} className="h-2" />
                                    <span className="text-sm font-medium">
                                      {formatPercentage(technique.metrics.npv.value)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FlaskConical size={48} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">No Experiments Yet</h3>
                    <p className="text-gray-500 mb-4">
                      Start by adding experimental data using manual entry or file upload
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;