import { useState } from 'react';
import { supabase } from '../services/supabase';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert('Logged in successfully!');
  };

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Signed up successfully! Check your email to confirm.');
  };

  return (
    <div>
      <h1>Login / Sign Up</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  );
};

export default Auth;