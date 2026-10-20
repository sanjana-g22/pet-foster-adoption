 "use client";
import { useEffect, useState, type FormEvent } from "react";

export default function AdopterProfilePage() {
  const [form, setForm] = useState({ home_type: "apartment", has_children: false, has_other_pets: false, experience: "first_time", activity_level: 3, lifestyle_text: "" });
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/adopter/profile").then(r => r.json()).then(d => { if (d.profile) setForm(f => ({ ...f, ...d.profile })); }).catch(() => setMessage("Could not load profile.")); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("Saving…");
    const res = await fetch("/api/adopter/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json(); setMessage(res.ok ? "Profile saved!" : data.error ?? "Could not save profile.");
  }
  return <main className="mx-auto max-w-2xl px-4 py-10"><h1 className="text-3xl font-bold text-teal-800">Adopter profile</h1><p className="mt-2 text-gray-600">Tell us about your home and lifestyle so we can suggest suitable pets.</p>
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border p-5">
      <label className="block text-sm">Home type<select className="mt-1 w-full rounded-md border p-2" value={form.home_type} onChange={e=>setForm({...form,home_type:e.target.value})}><option value="apartment">Apartment</option><option value="house_small_yard">House with small yard</option><option value="house_large_yard">House with large yard</option><option value="farm">Farm</option></select></label>
      <label className="block text-sm">Experience<select className="mt-1 w-full rounded-md border p-2" value={form.experience} onChange={e=>setForm({...form,experience:e.target.value})}><option value="first_time">First-time owner</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></label>
      <label className="block text-sm">Activity level (1 low – 5 high)<input type="number" min="1" max="5" className="mt-1 w-full rounded-md border p-2" value={form.activity_level} onChange={e=>setForm({...form,activity_level:Number(e.target.value)})}/></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.has_children} onChange={e=>setForm({...form,has_children:e.target.checked})}/> Children at home</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.has_other_pets} onChange={e=>setForm({...form,has_other_pets:e.target.checked})}/> Other pets at home</label>
      <label className="block text-sm">Lifestyle / ideal companion<textarea required maxLength={4000} className="mt-1 min-h-28 w-full rounded-md border p-2" value={form.lifestyle_text} onChange={e=>setForm({...form,lifestyle_text:e.target.value})} placeholder="e.g. Calm indoor companion, apartment, daily walks, good with children"/></label>
      <button className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white">Save profile</button>{message && <p className="text-sm">{message}</p>}
    </form></main>;
}
