 "use client";
import { useEffect, useState, type FormEvent } from "react";

type AppRow = { id:number; pet_id:number; pet_name:string; species:string; status:string; message:string; submitted_at:string; review_note:string|null };
export default function ApplicationsPage() {
  const [apps,setApps] = useState<AppRow[]>([]);
  const [petId,setPetId] = useState(""); const [message,setMessage] = useState(""); const [notice,setNotice] = useState("");
  async function load(){ const r=await fetch("/api/applications"); const d=await r.json(); if(r.ok) setApps(d.applications); else setNotice(d.error ?? "Could not load applications."); }
  useEffect(()=>{ void load(); },[]);
  async function submit(e:FormEvent){ e.preventDefault(); setNotice("Submitting…"); const r=await fetch("/api/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pet_id:Number(petId),message})}); const d=await r.json(); setNotice(r.ok?"Application submitted!":d.error??"Submission failed."); if(r.ok){setPetId("");setMessage(""); await load();} }
  return <main className="mx-auto max-w-4xl px-4 py-10"><h1 className="text-3xl font-bold text-teal-800">My applications</h1><p className="mt-2 text-gray-600">Submit an application using a pet ID from the pet browsing page, then track its status here.</p>
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-xl border p-5"><h2 className="font-semibold">Apply for a pet</h2><label className="block text-sm">Pet ID<input required type="number" min="1" value={petId} onChange={e=>setPetId(e.target.value)} className="mt-1 w-full rounded-md border p-2"/></label><label className="block text-sm">Why would you be a good match?<textarea required maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)} className="mt-1 min-h-24 w-full rounded-md border p-2"/></label><button className="rounded-md bg-teal-700 px-4 py-2 text-white">Submit application</button>{notice&&<p className="text-sm">{notice}</p>}</form>
    <h2 className="mt-10 text-xl font-semibold">Application tracker</h2><div className="mt-3 space-y-3">{apps.map(a=><article key={a.id} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>#{a.id} · {a.pet_name} ({a.species})</strong><span className="rounded-full bg-teal-50 px-3 py-1 text-sm">{a.status}</span></div><p className="mt-2 text-sm text-gray-600">{a.message}</p>{a.review_note&&<p className="mt-2 text-sm">Review note: {a.review_note}</p>}</article>)}{apps.length===0&&<p className="text-sm text-gray-500">No applications yet.</p>}</div></main>;
}
