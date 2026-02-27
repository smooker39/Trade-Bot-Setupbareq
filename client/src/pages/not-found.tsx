import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background bg-grid-pattern p-4">
      <Card className="w-full max-w-md border-border shadow-2xl">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <h1 className="text-2xl font-bold font-mono">404 Error</h1>
          </div>
          <p className="mt-4 text-muted-foreground font-mono text-sm">
            The requested trading algorithm or route does not exist within the system parameters.
          </p>

          <div className="mt-6 flex justify-end">
             <Link 
               href="/" 
               className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
             >
               Return to Terminal
             </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
