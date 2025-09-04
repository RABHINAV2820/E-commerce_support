"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./faq.module.css";

type FAQ = {
  id: string;
  question: string;
  answer: string;
};

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFAQs() {
      try {
        const { data, error } = await supabase
          .from("faq")
          .select("id, question, answer")
          .order("question");
        
        if (error) throw error;
        setFaqs(data || []);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFAQs();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading FAQs...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Frequently Asked Questions</h1>
        <p>Find answers to common questions about our products and services</p>
      </div>
      
      <div className={styles.faqList}>
        {faqs.map((faq) => (
          <div key={faq.id} className={styles.faqItem}>
            <h3 className={styles.question}>{faq.question}</h3>
            <p className={styles.answer}>{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
