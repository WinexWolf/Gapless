import React from "react";
import { SignIn, SignUp } from "@clerk/react";

const Wrap = ({ children }) => (
  <div className="auth-screen" data-testid="auth-screen">
    <div className="auth-brand">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Gapless</span>
    </div>
    <div className="auth-card-wrap">{children}</div>
    <p className="auth-foot tiny muted">Close the payroll gap before Friday.</p>
  </div>
);

export function SignInPage() {
  return (
    <Wrap>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp fallbackRedirectUrl="/app" />
    </Wrap>
  );
}

export function SignUpPage() {
  return (
    <Wrap>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/app" />
    </Wrap>
  );
}
