import Link from "next/link";
import {notFound} from "next/navigation";
import {requirePage} from "@/lib/page-auth";
import {query} from "@/lib/db";
import IntakeForm from "@/components/IntakeForm";
import IntakeReview from "@/components/IntakeReview";
export const dynamic="force-dynamic";
function Details({data}:{data:Record<string,unknown>}) {
 return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(data).map(([key,value])=><div key={key} className="min-w-0"><dt className="font-semibold capitalize">{key.replace(/([A-Z])/g," $1")}</dt><dd className="whitespace-pre-wrap break-words">{typeof value==="boolean"?(value?"Yes":"No / not confirmed"):typeof value==="string"&&["recordUrl","photoUrl"].includes(key)&&/^https?:\/\//i.test(value)?<a className="underline" href={value} target="_blank" rel="noopener noreferrer">Open submitted link</a>:String(value??"Not provided")||"Not provided"}</dd></div>)}</dl>;
}
export default async function IntakeDetail({params}:{params:Promise<{id:string}>}) {
 const user=await requirePage("foster","staff","admin");const id=Number((await params).id);
 if(!Number.isSafeInteger(id)||id<1)notFound();
 const r=(await query<{id:number;submitted_by:number;details:Record<string,unknown>;status:string;review_note:string|null;pet_id:number|null}>("SELECT * FROM intake_requests WHERE id=$1",[id])).rows[0];
 if(!r)notFound();
 const events=(await query<{id:number;actor_name:string;status:string;note:string|null;details:Record<string,unknown>;created_at:Date}>("SELECT * FROM intake_events WHERE request_id=$1 ORDER BY id",[id])).rows;
 const staff=user.role==="staff"||user.role==="admin";
 return <main className="page-shell max-w-4xl space-y-7 py-8">
 <Link href="/intakes" className="underline">Back to intake requests</Link><h1 className="text-3xl font-bold">Intake request #{id}</h1>
 <p className="font-semibold">Status: {r.status.replaceAll("_"," ")} · Submitted by user #{r.submitted_by}</p>
 {r.review_note&&<p className="rounded border p-4">Staff feedback: {r.review_note}</p>}
 <section className="rounded-xl border bg-white p-5"><Details data={r.details}/></section>
 {staff&&r.status==="pending"&&<IntakeReview id={id}/>}
 {staff&&r.pet_id&&<div className="rounded border p-5"><p>Approved intake. Verify health and vaccination records before making the pet available. Arrange placements separately.</p><Link href={`/staff/pets/${r.pet_id}`} className="font-bold underline">Manage pet #{r.pet_id}</Link></div>}
 {!staff&&r.status==="needs_information"&&user.isApproved&&<section><h2 className="mb-4 text-xl font-bold">Update and resubmit</h2><IntakeForm id={id} initial={r.details}/></section>}
 <section className="space-y-4"><h2 className="text-2xl font-bold">Request history</h2>{events.map(e=><article key={e.id} className="rounded border p-4"><p className="font-semibold">{e.status.replaceAll("_"," ")} · {e.actor_name}</p><p>{new Date(e.created_at).toLocaleString("en-GB",{timeZone:"Asia/Kolkata"})} IST</p><p className="whitespace-pre-wrap">{e.note}</p><details className="mt-3"><summary>Details at this stage</summary><Details data={e.details}/></details></article>)}</section>
 </main>;
}
