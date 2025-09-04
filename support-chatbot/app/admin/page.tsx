"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import styles from "./admin.module.css";

type Escalation = {
  id: string;
  session_id: string;
  user_query: string;
  ai_reply: string;
  created_at: string;
  resolution_status?: string;
};

export default function AdminDashboard() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== "admin") {
      router.push("/login");
      return;
    }

    fetchEscalations();
  }, [router]);

  async function fetchEscalations() {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("escalation_flag", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setEscalations(data || []);
    } catch (error) {
      console.error("Error fetching escalations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConversationHistory(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setConversationHistory(data || []);
    } catch (error) {
      console.error("Error fetching conversation history:", error);
    }
  }

  async function updateResolutionStatus(escalationId: string, status: string) {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ resolution_status: status })
        .eq("id", escalationId);
      
      if (error) throw error;
      
      // Update local state
      setEscalations(prev => 
        prev.map(esc => 
          esc.id === escalationId ? { ...esc, resolution_status: status } : esc
        )
      );
    } catch (error) {
      console.error("Error updating resolution status:", error);
    }
  }

  function handleEscalationClick(escalation: Escalation) {
    setSelectedEscalation(escalation);
    fetchConversationHistory(escalation.session_id);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Admin Dashboard</h1>
        <p>Manage customer escalations and support requests</p>
      </div>

      <div className={styles.dashboard}>
        <div className={styles.escalationsPanel}>
          <h2>Escalation Queue ({escalations.length})</h2>
          <div className={styles.escalationsList}>
            {escalations.map((escalation) => (
              <div 
                key={escalation.id} 
                className={`${styles.escalationItem} ${selectedEscalation?.id === escalation.id ? styles.selected : ''}`}
                onClick={() => handleEscalationClick(escalation)}
              >
                <div className={styles.escalationHeader}>
                  <span className={styles.sessionId}>Session: {escalation.session_id?.slice(0, 8) || 'N/A'}...</span>
                  <span className={styles.timestamp}>
                    {new Date(escalation.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.preview}>
                  <strong>Query:</strong> {escalation.user_query}
                </div>
                <div className={styles.status}>
                  Status: {escalation.resolution_status || "Pending"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedEscalation && (
          <div className={styles.conversationPanel}>
            <div className={styles.conversationHeader}>
              <h3>Conversation History</h3>
              <div className={styles.resolutionControls}>
                <label>Resolution Status:</label>
                <select 
                  value={selectedEscalation.resolution_status || "Pending"}
                  onChange={(e) => updateResolutionStatus(selectedEscalation.id, e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Needs Follow-up">Needs Follow-up</option>
                </select>
              </div>
            </div>
            
            <div className={styles.conversationHistory}>
              {conversationHistory.map((msg, index) => (
                <div key={index} className={styles.message}>
                  <div className={styles.messageHeader}>
                    <span className={styles.messageType}>
                      {msg.user_query ? "User" : "Bot"}
                    </span>
                    <span className={styles.messageTime}>
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.messageContent}>
                    {msg.user_query || msg.ai_reply}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
