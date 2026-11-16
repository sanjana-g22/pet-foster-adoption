"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
export default function IntakeReview({id}:{id:number}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget));
  try {const res=await fetch(`/api/intake-requests/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const result=await res.json();if(!res.ok) throw new Error(result.error);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Could not save decision");}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
  <h2 className="text-xl font-bold">Staff review</h2>
  <p>Check the submitted records and possible duplicates. Approval creates a pet in intake. Enter verified vaccinations on the pet management page before changing availability.</p>
  <label className="block">Decision<select name="decision" className="ml-3 rounded border p-2"><option value="needs_information">Request more information</option><option value="approved">Approve intake</option><option value="rejected">Reject request</option></select></label>
  <label className="block">Reason / instructions<textarea name="note" required minLength={3} maxLength={2000} className="mt-1 block w-full rounded border p-2" rows={3}/></label>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <button disabled={busy} className="rounded bg-[#245c45] px-4 py-2 text-white disabled:opacity-50">{busy?"Saving…":"Save decision"}</button>
 </form>;
}
