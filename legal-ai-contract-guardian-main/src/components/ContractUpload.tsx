import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContractUploadProps {
  onContractUploaded: (contract: any) => void;
}

export const ContractUpload = ({ onContractUploaded }: ContractUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.type.includes('text')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or text document.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const analysis = await response.json();
        // Transform backend response to match ContractAnalysis interface
        const transformedAnalysis = {
  fileName: file.name,
  fileSize: file.size,
  uploadedAt: new Date(),
  extractedText: analysis.extractedText || 'Text extraction not available',
  clauses: analysis.clauses || [],
  complianceScore: analysis.complianceScore,
  totalClauses: analysis.totalClauses,
  compliantClauses: analysis.compliantClauses,
  riskyClauses: analysis.riskyClauses,
};

        onContractUploaded(transformedAnalysis);
        toast({
          title: 'Contract analyzed successfully',
          description: `Found ${transformedAnalysis.totalClauses} clauses with compliance score of ${transformedAnalysis.complianceScore}%`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: 'Upload failed',
          description: errorData.error || 'There was an error processing your contract.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: 'There was an error processing your contract.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onContractUploaded, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-soft">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold bg-gradient-legal bg-clip-text text-transparent">
          Upload Contract for Analysis
        </CardTitle>
        <CardDescription>
          Upload your contract document to analyze compliance and identify potential risks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            isDragging
              ? 'border-primary bg-legal-blue-light'
              : 'border-border hover:border-primary'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
        >
          <div className="flex flex-col items-center gap-4">
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">
                  Analyzing contract with AI...
                </p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    Drop your contract here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF, DOC, and TXT files
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="contract-upload"
                />
                <label htmlFor="contract-upload">
                  <Button variant="legal" asChild>
                    <span className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Select Contract
                    </span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-compliance-green" />
            <p className="text-sm font-medium">AI Analysis</p>
            <p className="text-xs text-muted-foreground">Intelligent clause extraction</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 text-warning" />
            <p className="text-sm font-medium">Risk Detection</p>
            <p className="text-xs text-muted-foreground">Identify compliance issues</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Detailed Report</p>
            <p className="text-xs text-muted-foreground">Comprehensive analysis</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};