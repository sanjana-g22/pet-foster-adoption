"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
const fields = [
 ["name","Pet name or temporary name","text",true], ["breed","Breed, if known","text",false],
 ["ageMonths","Estimated age (months)","number",true], ["weightKg","Estimated weight (kg)","number",true],
 ["microchipNo","Microchip number, if known","text",false], ["photoUrl","Pet photo link (http/https)","url",false],
 ["foundLocation","Location found","text",true], ["foundDate","Date found","date",true],
 ["recordUrl","Vaccination / medical record link (http/https)","url",false],
] as const;
const areas = [["description","Description"],["temperament","Temperament"],["specialNeeds","Special needs"],
 ["healthNotes","Health observations (write unknown if unsure)"],["vaccineNotes","Vaccinations: names, dates, expiry, vet, or unknown"]] as const;
const checks = [["temporarilyCaring","I am temporarily caring for this pet"],["goodWithKids","Known to be good with children"],
 ["goodWithPets","Known to be good with other pets"],["apartmentFriendly","Apartment friendly"],["houseTrained","House trained"]] as const;
export default function IntakeForm({id,initial={}}:{id?:number;initial?:Record<string,unknown>}) {
 const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError("");
  const fd=new FormData(e.currentTarget);const body:Record<string,unknown>=Object.fromEntries(fd);
  for(const k of ["ageMonths","weightKg","energyLevel"]) body[k]=Number(fd.get(k));
  for(const [k] of checks) body[k]=fd.has(k);
  try {
   const res=await fetch(id?`/api/intake-requests/${id}`:"/api/intake-requests",{method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const result=await res.json();
   if(!res.ok) throw new Error(result.error+(Array.isArray(result.details)?": "+result.details.map((d:{field:string;message:string})=>`${d.field}: ${d.message}`).join("; "):""));
   router.push(`/intakes/${result.data.id}`);router.refresh();
  } catch(e) {setError(e instanceof Error?e.message:"Request failed. Please try again.");} finally {setBusy(false);}
 }
 const input="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2";
 return <form onSubmit={submit} className="space-y-5">
  <p>These details are a report for staff review. Unknown vaccination history is allowed. Approval does not publish the pet or assign it to you.</p>
  <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key,title,type,required])=><label key={key} className="text-sm font-medium">{title}{required?" *":""}<input className={input} name={key} type={type} required={required} defaultValue={String(initial[key]??"")} min={key==="weightKg"?"0.01":key==="ageMonths"?"0":undefined} max={key==="weightKg"?"200":key==="ageMonths"?"360":undefined} step={key==="weightKg"?"0.01":undefined} /></label>)}
  {([ ["species","Species",["dog","cat","rabbit","other"]],["sex","Sex",["unknown","male","female"]],["size","Size",["small","medium","large"]],["energyLevel","Energy level (1 low, 5 high)",["1","2","3","4","5"]] ] as const).map(([key,title,options])=><label key={key} className="text-sm font-medium">{title}<select name={key} className={input} defaultValue={String(initial[key]??(key==="energyLevel"?"3":options[0]))}>{options.map(v=><option key={v}>{v}</option>)}</select></label>)}
  </div>
  {areas.map(([key,title])=><label key={key} className="block text-sm font-medium">{title}<textarea className={input} name={key} rows={3} required={key==="healthNotes"||key==="vaccineNotes"} defaultValue={String(initial[key]??"")} /></label>)}
  <p className="text-sm">For records and photos, paste an existing link staff can access. This form does not upload files. Leave behaviour checkboxes unchecked when unknown; staff can confirm these later.</p>
  {checks.map(([key,title])=><label key={key} className="block"><input type="checkbox" name={key} defaultChecked={initial[key]===true} className="mr-2" />{title}</label>)}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <button disabled={busy} className="rounded-lg bg-[#245c45] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"Saving…":id?"Resubmit for review":"Submit intake request"}</button>
 </form>;
}
