import { Shield, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import legalShieldLogo from '@/assets/legal-shield-logo.png';

export const Header = () => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={legalShieldLogo} alt="Legal AI Guardian" className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold bg-gradient-legal bg-clip-text text-transparent">
              Legal AI Contract Guardian
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-Powered Contract Compliance & Risk Analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Smart Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-muted-foreground">Risk Detection</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-compliance-green" />
              <span className="text-muted-foreground">Compliance Check</span>
            </div>
          </div>
          
          <Button variant="outline" size="sm">
            Dashboard
          </Button>
        </div>
      </div>
    </header>
  );
};