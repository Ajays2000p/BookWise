import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "otp" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const sendOtp = () => {
    if (!email) { toast({ title: "Enter your email", variant: "destructive" }); return; }
    toast({ title: "OTP sent!" });
    setStep("otp");
  };

  const verifyOtp = () => {
    if (otp.length === 6) { setStep("reset"); }
    else { toast({ title: "Invalid OTP", variant: "destructive" }); }
  };

  const resetPassword = () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Passwords must match", variant: "destructive" });
      return;
    }
    toast({ title: "Password reset successfully!" });
    setStep("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-2">
          <Link to="/">
            <img src="/bookwise-logo.png" alt="BookWise Logo" className="h-12 w-12 mx-auto mb-4 object-contain" />
          </Link>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "otp" && "Enter the 6-digit code sent to your email"}
            {step === "reset" && "Choose a new password"}
            {step === "done" && "Your password has been reset!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" && (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button className="w-full" onClick={sendOtp}>Send Reset Code</Button>
            </>
          )}
          {step === "otp" && (
            <>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full" onClick={verifyOtp}>Verify Code</Button>
            </>
          )}
          {step === "reset" && (
            <>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={resetPassword}>Reset Password</Button>
            </>
          )}
          {step === "done" && (
            <Button className="w-full" asChild>
              <Link to="/login">Back to Login</Link>
            </Button>
          )}
          {step !== "done" && (
            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft size={14} /> Back to login
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
