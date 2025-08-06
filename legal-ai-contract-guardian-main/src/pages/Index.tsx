import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ContractUpload } from '@/components/ContractUpload';
import { ComplianceAnalysis } from '@/components/ComplianceAnalysis';
import type { ContractAnalysis } from '@/components/ComplianceAnalysis';


const Index = () => {
  const [contractAnalysis, setContractAnalysis] = useState<ContractAnalysis | null>(null);

   useEffect(() => {
    document.title = "Compliance Auditor";
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-legal-blue-light/20 to-compliance-green-light/20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {!contractAnalysis ? (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                AI-Powered Contract Guardian
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Upload your contracts and get instant AI-powered compliance analysis, risk detection, 
                and regulatory compliance checking to protect your business interests.
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">98%</p>
                  <p className="text-sm text-muted-foreground">Accuracy Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-compliance-green">50+</p>
                  <p className="text-sm text-muted-foreground">Regulations Covered</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">2 min</p>
                  <p className="text-sm text-muted-foreground">Analysis Time</p>
                </div>
              </div>
            </div>

            {/* Upload Section */}
            <ContractUpload onContractUploaded={setContractAnalysis} />

            {/* Features Section */}
            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <div className="text-center p-6 rounded-lg bg-card border shadow-soft">
                <div className="w-12 h-12 bg-gradient-legal rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary-foreground font-bold">AI</span>
                </div>
                <h3 className="font-semibold mb-2">Smart Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Advanced NLP models extract and analyze contract clauses with precision
                </p>
              </div>
              
              <div className="text-center p-6 rounded-lg bg-card border shadow-soft">
                <div className="w-12 h-12 bg-gradient-compliance rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-accent-foreground font-bold">⚖️</span>
                </div>
                <h3 className="font-semibold mb-2">Compliance Check</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically verify against GDPR, CCPA, and other regulations
                </p>
              </div>
              
              <div className="text-center p-6 rounded-lg bg-card border shadow-soft">
                <div className="w-12 h-12 bg-warning rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-warning-foreground font-bold">🛡️</span>
                </div>
                <h3 className="font-semibold mb-2">Risk Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Identify potential legal risks and get actionable recommendations
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ComplianceAnalysis 
            analysis={contractAnalysis} 
            onBackToUpload={() => setContractAnalysis(null)}
          />
        )}
      </main>
    </div>
  );
};

export default Index;