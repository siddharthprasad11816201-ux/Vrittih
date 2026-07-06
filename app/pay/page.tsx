﻿"use client"
import { useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
declare global {
  interface Window { Razorpay: any }
}

export default function PayPage() {
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<"jobseeker"|"employer">("jobseeker")

  async function handlePay() {
    setLoading(true)
    const res = await fetch("/api/payment/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "temp_user_id", type }),
    })
    const { orderId, amount, currency } = await res.json()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    document.body.appendChild(script)
    script.onload = () => {
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount, currency,
        order_id: orderId,
        name: "Vrittih",
        description: "1 CHF joining fee",
        handler: async function(response: any) {
          const verify = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, userId: "temp_user_id", type }),
          })
          const result = await verify.json()
          if (result.success) alert("Payment successful! Welcome to Vrittih.")
        },
        theme: { color: "#185FA5" },
      })
      rzp.open()
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div style={{minHeight:"calc(100vh - 56px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem",background:"#f9fafb"}}>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:"16px",padding:"2.5rem",width:"100%",maxWidth:"400px",textAlign:"center"}}>
          <h1 style={{fontSize:"22px",fontWeight:500,marginBottom:"6px"}}>Join Vrittih</h1>
          <p style={{fontSize:"14px",color:"#6b7280",marginBottom:"1.5rem"}}>One-time fee. Full access. No subscription.</p>
          <div style={{marginBottom:"1.5rem"}}>
            <span style={{fontSize:"48px",fontWeight:500,color:"#185FA5"}}>1 CHF</span>
            <span style={{fontSize:"14px",color:"#9ca3af",marginLeft:"6px"}}>once</span>
          </div>
          <div style={{display:"flex",gap:"8px",marginBottom:"1.5rem"}}>
            <button onClick={()=>setType("jobseeker")} style={{flex:1,padding:"8px",border:`1px solid ${type==="jobseeker"?"#185FA5":"#e5e7eb"}`,borderRadius:"8px",background:type==="jobseeker"?"#E6F1FB":"#fff",color:type==="jobseeker"?"#185FA5":"#6b7280",cursor:"pointer"}}>Job seeker</button>
            <button onClick={()=>setType("employer")} style={{flex:1,padding:"8px",border:`1px solid ${type==="employer"?"#185FA5":"#e5e7eb"}`,borderRadius:"8px",background:type==="employer"?"#E6F1FB":"#fff",color:type==="employer"?"#185FA5":"#6b7280",cursor:"pointer"}}>Employer</button>
          </div>
          <ul style={{listStyle:"none",textAlign:"left",marginBottom:"1.75rem",display:"flex",flexDirection:"column",gap:"8px"}}>
            {type==="jobseeker" ? <>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Apply to all jobs</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Full profile + resume upload</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Network with professionals</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Lifetime access</li>
            </> : <>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Post 1 job position — unlimited reposts</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ View all applicants</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Recruiter dashboard</li>
              <li style={{fontSize:"14px",color:"#374151"}}>✓ Pay 1 CHF per extra position</li>
            </>}
          </ul>
          <button onClick={handlePay} disabled={loading} style={{width:"100%",padding:"12px",background:loading?"#9ca3af":"#185FA5",color:"#fff",border:"none",borderRadius:"10px",fontSize:"15px",cursor:loading?"not-allowed":"pointer",fontWeight:500}}>
            {loading ? "Loading..." : "Pay 1 CHF with Razorpay"}
          </button>
          <p style={{fontSize:"12px",color:"#9ca3af",marginTop:"12px"}}>Secure payment. 1 CHF, one-time — no subscription.</p>
        </div>
      </div>
    </AppShell>
  )
}
