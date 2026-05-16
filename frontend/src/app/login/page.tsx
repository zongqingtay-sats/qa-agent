/**
 * Login page.
 *
 * Renders a Microsoft sign-in button. When OAuth is not configured,
 * redirects to the dashboard automatically.
 */

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <FlaskConical className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">QA Agent</CardTitle>
          <CardDescription>Sign in to access your QA testing workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              signIn("microsoft-entra-id", { callbackUrl: "/" });
            }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in with Microsoft
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
