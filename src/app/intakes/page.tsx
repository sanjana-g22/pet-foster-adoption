import Link from "next/link";
import {requirePage} from "@/lib/page-auth";
import {query} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Intakes({searchParams}:{searchParams:Promise<{page?:string}>}) {
 const user=await requirePage("foster","staff","admin");
 const sp=await searchParams;const page=Math.max(1,Math.min(100000,Math.floor(Number(sp.page)||1)));
 const rows=(await query<{id:number;status:string;details:{name:string;species:string};created_at:Date}>("SELECT id,status,details,created_at FROM intake_requests ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET $1",[(page-1)*20])).rows;
 return <main className="page-shell space-y-6 py-8"><h1 className="text-3xl font-bold">{user.role==="foster"?"My pet intake requests":"Foster intake requests"}</h1>
 <p>{user.role==="foster"?"Report a found pet and track staff feedback here.":"Review foster reports, supporting records and the complete request history."}</p>
 {user.role==="foster"&&(user.isApproved?<Link className="inline-block rounded bg-[#245c45] px-4 py-2 text-white" href="/intakes/new">Report a found pet</Link>:<p>Your foster account must be approved before you can submit.</p>)}
 {!rows.length&&<p>No intake requests on this page.</p>}
 <div className="space-y-3">{rows.slice(0,20).map(r=><Link className="block rounded-xl border bg-white p-4" key={r.id} href={`/intakes/${r.id}`}><strong>#{r.id} {r.details.name}</strong><p>{r.details.species} · {r.status.replaceAll("_"," ")} · {new Date(r.created_at).toLocaleDateString("en-GB")}</p></Link>)}</div>
 <div className="flex gap-5">{page>1&&<Link href={`/intakes?page=${page-1}`}>Previous</Link>}{rows.length>20&&<Link href={`/intakes?page=${page+1}`}>Next</Link>}</div></main>;
}
