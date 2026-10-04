import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { BookOpen, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const sendOtp = () => {
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setOtpSent(true);
    setTimer(60);
    toast({ title: "OTP sent to your email" });
  };

  const verifyOtp = () => {
    if (otp.length === 6) {
      setOtpVerified(true);
      toast({ title: "Email verified!" });
    } else {
      toast({ title: "Invalid OTP", variant: "destructive" });
    }
  };

  const hasEightChars = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);
  const isPasswordValid = hasEightChars && hasUppercase && hasNumber && hasSpecialChar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (!isPasswordValid) {
      toast({ title: "Password is too weak", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (otpSent && !otpVerified) {
      toast({ title: "Please verify your email first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      toast({ title: "Account created successfully! Please select your favorite genres." });
      navigate("/genre-selection");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Registration failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-2">
          <Link to="/">
            <img src="/bookwise-logo.png" alt="BookWise Logo" className="h-12 w-12 mx-auto mb-4 object-contain" />
          </Link>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join BookWise and discover your next read</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <div className="flex gap-2">
                <Input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={sendOtp} disabled={otpVerified || timer > 0} className={timer > 0 ? "text-muted-foreground w-28" : "w-28"}>
                  {otpVerified ? <CheckCircle size={16} className="text-green-500" /> : timer > 0 ? `Resend in ${timer}s` : otpSent ? "Resend OTP" : "Send OTP"}
                </Button>
              </div>
            </div>
            {otpSent && (
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <div className="flex items-center gap-2">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(val) => {
                      setOtp(val);
                      if (val.length === 6) {
                        setOtpVerified(true);
                        toast({ title: "Email verified!" });
                      }
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    size="sm"
                    onClick={verifyOtp}
                    variant={otpVerified ? "default" : "outline"}
                    className={otpVerified ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  >
                    {otpVerified ? "Verified ✓" : "Verify"}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              {password.length > 0 && (
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className={`flex items-center gap-1.5 ${hasEightChars ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {hasEightChars ? <CheckCircle size={14} /> : <X size={14} />} <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {hasUppercase ? <CheckCircle size={14} /> : <X size={14} />} <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {hasNumber ? <CheckCircle size={14} /> : <X size={14} />} <span>One numeric digit</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSpecialChar ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {hasSpecialChar ? <CheckCircle size={14} /> : <X size={14} />} <span>One special character (!@#$)</span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || (otpSent && !otpVerified)}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
