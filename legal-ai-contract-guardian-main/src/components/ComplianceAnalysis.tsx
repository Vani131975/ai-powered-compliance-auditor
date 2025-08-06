import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Eye,
  ArrowLeft,
  FileText,
  Shield,
  TrendingUp,
  Clock,
  Users,
} from 'lucide-react';
import axios from 'axios';

interface ClauseAnalysis {
  id: number;
  type: string;
  text: string;
  complianceStatus: 'compliant' | 'review_needed' | 'non_compliant';
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface Party {
  name: string;
  type: 'person' | 'org';
  context: string;
}

export interface ContractAnalysis {
  fileName: string;
  fileSize: number;
  uploadedAt: string; // FIX: backend sends string, not Date
  extractedText: string;
  clauses: ClauseAnalysis[];
  complianceScore: number;
  totalClauses: number;
  compliantClauses: number;
  riskyClauses: number;
  recommendations: string;
  parties: Party[];
  originalFileUrl?: string; // Added for original file access
}

interface ComplianceAnalysisProps {
  analysis: ContractAnalysis;
  onBackToUpload: () => void;
}

export const ComplianceAnalysis = ({ analysis, onBackToUpload }: ComplianceAnalysisProps) => {
  console.log('Received analysis:', analysis);

  const formatClauseType = (type: string | undefined | null): string => {
    if (typeof type !== 'string') {
      console.warn('Invalid clause type:', type);
      return 'Unknown';
    }
    return type.replace('_', ' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-compliance-green-light text-compliance-green border-compliance-green';
      case 'review_needed':
        return 'bg-risk-amber-light text-risk-amber border-risk-amber';
      case 'non_compliant':
        return 'bg-violation-red-light text-violation-red border-violation-red';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'review_needed':
        return <AlertTriangle className="h-4 w-4" />;
      case 'non_compliant':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-compliance-green';
      case 'medium':
        return 'text-warning';
      case 'high':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  // Fallback to clause-level recommendations if overall is missing
  const overallRecommendations =
    analysis?.recommendations?.trim() ||
    (analysis?.clauses?.length
      ? analysis.clauses.map(c => `- ${c.recommendation}`).join('\n')
      : 'Generating recommendations...');

  // Handler for viewing the original contract
  const handleViewOriginal = () => {
    if (analysis.originalFileUrl) {
      window.open(analysis.originalFileUrl, '_blank');
    } else {
      console.warn('Original file URL not provided');
      alert('Original file is not available. Please ensure the file was uploaded correctly.');
    }
  };

  // Handler for exporting the report as a PDF
  const handleExportReport = async () => {
    try {
      const response = await axios.post('http://localhost:5000/export-report', analysis, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${analysis.fileName}_analysis_report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report. Please ensure the backend server is running and try again.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" onClick={onBackToUpload} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Upload New Contract
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Contract Analysis Report</h1>
          <p className="text-muted-foreground">
            Comprehensive AI-powered compliance and risk assessment for {analysis.fileName}
          </p>
        </div>
      </div>

      {/* Executive Summary Card */}
      <Card className="shadow-soft border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Executive Summary
              </CardTitle>
              <CardDescription>
                {analysis.fileName} • {(analysis.fileSize / 1024).toFixed(1)} KB • Analyzed on{' '}
                {new Date(analysis.uploadedAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="legal" size="sm" onClick={handleExportReport}>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Overall Score</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">{analysis.complianceScore}%</span>
                  <Badge
                    variant={
                      analysis.complianceScore >= 80
                        ? 'default'
                        : analysis.complianceScore >= 60
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {analysis.complianceScore >= 80
                      ? 'Excellent'
                      : analysis.complianceScore >= 60
                      ? 'Good'
                      : 'Needs Work'}
                  </Badge>
                </div>
                <Progress value={analysis.complianceScore} className="h-2" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Clauses</p>
              <p className="text-3xl font-bold">{analysis.totalClauses}</p>
              <p className="text-sm text-muted-foreground">Analyzed by AI</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Compliant</p>
              <p className="text-3xl font-bold text-compliance-green">{analysis.compliantClauses}</p>
              <p className="text-sm text-muted-foreground">Ready to use</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Need Review</p>
              <p className="text-3xl font-bold text-warning">{analysis.riskyClauses}</p>
              <p className="text-sm text-muted-foreground">Require attention</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
              <p className="text-3xl font-bold text-warning">
                {analysis.complianceScore >= 80
                  ? 'Low'
                  : analysis.complianceScore >= 60
                  ? 'Medium'
                  : 'High'}
              </p>
              <p className="text-sm text-muted-foreground">Monitor closely</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extracted Text Preview */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Extracted Contract Text
          </CardTitle>
          <CardDescription>Preview of the uploaded document text</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-60 font-mono">
            {analysis.extractedText}
          </pre>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="clauses" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="clauses" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Clauses
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Actions
          </TabsTrigger>
        </TabsList>

        {/* Clause Analysis Tab */}
        <TabsContent value="clauses" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Clause-by-Clause Analysis</CardTitle>
              <CardDescription>
                Detailed AI analysis of each contract provision with compliance scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.clauses.map((clause) => (
                  <div
                    key={clause.id}
                    className="border rounded-lg p-4 hover:shadow-soft transition-shadow bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">
                            {formatClauseType(clause.type)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusColor(clause.complianceStatus)}
                          >
                            {getStatusIcon(clause.complianceStatus)}
                            {clause.complianceStatus.replace('_', ' ')}
                          </Badge>
                          <span className={`text-sm font-medium ${getRiskColor(clause.riskLevel)}`}>
                            {clause.riskLevel.toUpperCase()} RISK
                          </span>
                        </div>

                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-sm leading-relaxed font-mono">"{clause.text}"</p>
                        </div>

                        {clause.recommendation && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h4 className="text-sm font-semibold mb-2">AI Recommendation:</h4>
                            <p className="text-sm whitespace-pre-wrap">{clause.recommendation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parties Tab */}
        <TabsContent value="parties" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Parties Involved</CardTitle>
              <CardDescription>
                Identified parties in the contract based on named entity recognition
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(analysis.parties) && analysis.parties.length > 0 ? (
                <div className="space-y-4">
                  {analysis.parties.map((party, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:shadow-soft transition-shadow bg-card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {party.type}
                            </Badge>
                            <span className="text-lg font-semibold">{party.name}</span>
                          </div>
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-sm leading-relaxed font-mono">"{party.context}"</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No parties identified in the contract.{' '}
                  <span className="text-red-500">
                    Debug: parties = {JSON.stringify(analysis.parties)}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Actions Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                Recommended Actions
              </CardTitle>
              <CardDescription>
                Critical compliance issues and prioritized actions for this contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{overallRecommendations}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
