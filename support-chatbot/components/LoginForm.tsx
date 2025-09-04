"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, setCurrentUser } from "@/lib/auth";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    const user = login(username, password);
    if (user) {
      setCurrentUser(user);
      router.push("/");
    } else {
      setError("Invalid credentials. Try user123/pass123 or admin123/pass123");
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Login</h1>
        <p className={styles.subtitle}>Demo credentials:</p>
        <div className={styles.credentials}>
          <div>User: <code>user123</code> / <code>pass123</code></div>
          <div>Admin: <code>admin123</code> / <code>pass123</code></div>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          
          {error && <div className={styles.error}>{error}</div>}
          
          <button type="submit" className={styles.button}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
