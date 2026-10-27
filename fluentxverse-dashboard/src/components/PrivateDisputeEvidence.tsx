import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../api/apiClient';
import { describeAttendanceClaim, type LessonEvidenceRecord } from '../../../shared/lessonPrivacy';
import './PrivateDisputeEvidence.css';

export default function PrivateDisputeEvidence({ source, reportId }: { source: 'student'|'tutor'; reportId: string }) {
  const [open,setOpen]=useState(false),[rows,setRows]=useState<LessonEvidenceRecord[]|null>(null),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if (!open) { setRows(null); return; }
    const controller=new AbortController(); setRows(null);setError('');
    apiClient.get(`/lesson-privacy/admin/reports/${source}/${encodeURIComponent(reportId)}/evidence`,{signal:controller.signal}).then(({data})=>{
      if (!data.success) throw new Error(data.error||'Evidence unavailable');
      if (!controller.signal.aborted) setRows(data.data);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.error||e.message||'Evidence unavailable');});
    // Do not leave private evidence displayed indefinitely after consent is revoked.
    const timer=window.setTimeout(()=>setOpen(false),60000);
    return ()=>{controller.abort();clearTimeout(timer);};
  },[open,source,reportId,revision]);
  return <div className="private-dispute-evidence">
    <button type="button" onClick={()=>setOpen(value=>!value)}><i aria-hidden="true" className="ri-shield-check-line"/>{open?'Close private evidence':'Private evidence'}</button>
    {open&&<section aria-label="Consented dispute evidence">
      <header><strong>Consented attendance evidence</strong><button type="button" title="Refresh private evidence" aria-label="Refresh private evidence" onClick={()=>setRevision(v=>v+1)}><i aria-hidden="true" className="ri-refresh-line"/></button></header>
      {error&&<p role="alert">{error}</p>}{!error&&!rows&&<p role="status">Checking consent...</p>}
      {rows?.length===0&&<p>No unexpired evidence is shared by this report's author.</p>}
      {rows?.map(row=><article key={row.id}>
        <p><strong>{new Date(row.createdAt).toLocaleString()}</strong> / Threshold: {row.envelope.payload.thresholdMinutes} min</p>
        <dl>{row.envelope.payload.claims.attendance&&<><dt>Student presence</dt><dd>{describeAttendanceClaim(row.envelope.payload.claims.attendance.student)}</dd><dt>Tutor presence</dt><dd>{describeAttendanceClaim(row.envelope.payload.claims.attendance.tutor)}</dd></>}
          {row.envelope.payload.claims.overlap&&<><dt>Shared room presence</dt><dd>{describeAttendanceClaim(row.envelope.payload.claims.overlap)}</dd></>}
          {row.envelope.payload.claims.cancellation&&<><dt>Cancellation</dt><dd>{describeAttendanceClaim(row.envelope.payload.claims.cancellation)}</dd></>}
        </dl><p>Snapshot ID: {row.id}</p>
      </article>)}
      {!!rows?.length&&<p>Platform-signed room records, not proof of media connection or teaching quality. Missing observations do not establish absence. No automatic attendance correction or refund.</p>}
    </section>}
  </div>;
}
