import { useEffect, useRef, useState } from 'preact/hooks';
import { apiClient } from '../api/apiClient';
import './RecordingsPage.css';

type Recording = {id:string;booking_id:string;provider_status:string;local_status:string;invoked_at:string;expires_at:string;byte_size:number|null;error:string|null};
type Audit = {admin_id:string;action:string;detail:string;created_at:string};
export default function RecordingsPage() {
  const [rows,setRows]=useState<Recording[]>([]);
  const [page,setPage]=useState(1);
  const [booking,setBooking]=useState(new URLSearchParams(window.location.search).get('booking') || '');
  const [search,setSearch]=useState(new URLSearchParams(window.location.search).get('booking') || '');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<Recording|null>(null);
  const [logs,setLogs]=useState<Audit[]|null>(null);
  const [busy,setBusy]=useState(false);
  const requestVersion=useRef(0);
  const load=async()=>{
    const version=++requestVersion.current;
    setLoading(true);setError('');
    try{const r=await apiClient.get('/admin/recordings/',{params:{page,booking}});if(version===requestVersion.current)setRows(r.data.data);}
    catch{if(version===requestVersion.current)setError('Could not load recordings.');}
    finally{if(version===requestVersion.current)setLoading(false);}
  };
  useEffect(()=>{document.title='QA Recordings | FluentXVerse';void load();return()=>{requestVersion.current++;};},[page,booking]);
  const audit=async(row:Recording)=>{
    setSelected(row);setLogs([]);setError('');
    try{const r=await apiClient.get(`/admin/recordings/${row.id}/audit`);setLogs(r.data.data);}
    catch{setError('Could not load access history.');}
  };
  const remove=async(row:Recording)=>{
    if(!confirm('Permanently delete this local recording? The Cloudflare temporary copy expires separately after seven days.'))return;
    setBusy(true);setError('');
    try{await apiClient.delete(`/admin/recordings/${row.id}`);if(selected?.id===row.id)setSelected(null);await load();}
    catch{setError('Deletion failed. Please retry.');}finally{setBusy(false);}
  };
  const playbackUrl=(row:Recording)=>`${String(apiClient.defaults.baseURL).replace(/\/$/,'')}/admin/recordings/${row.id}/playback`;
  return <div className="qa-recordings-page">
    <header><div><h1>QA Recordings</h1><p>30-day retention · Encrypted local Seaweed storage</p></div><button type="button" title="Refresh recordings" aria-label="Refresh recordings" onClick={()=>void load()}><i className="ri-refresh-line"/></button></header>
    <form className="qa-recordings-search" onSubmit={event=>{event.preventDefault();setPage(1);setBooking(search.trim());}}>
      <input aria-label="Booking ID" placeholder="Booking ID" value={search} onInput={event=>setSearch(event.currentTarget.value)} maxLength={200}/><button type="submit"><i className="ri-search-line" aria-hidden="true"/>Search</button>
    </form>
    {error&&<div role="alert" className="qa-recordings-error">{error}</div>}
    {loading?<p role="status">Loading recordings...</p>:rows.length===0?<p>No recordings found.</p>:<div className="qa-recordings-table"><table><thead><tr><th>Lesson</th><th>Recorded</th><th>Provider</th><th>Local archive</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
      <td data-label="Lesson"><strong>{row.booking_id}</strong><small>{row.id}</small></td><td data-label="Recorded">{new Date(row.invoked_at).toLocaleString()}</td><td data-label="Provider">{row.provider_status.toLowerCase()}</td>
      <td data-label="Local archive">{row.local_status}{row.byte_size&&<small>{(Number(row.byte_size)/1048576).toFixed(1)} MB</small>}{row.error&&<small className="qa-recordings-error">{row.error}</small>}</td><td data-label="Expires">{new Date(row.expires_at).toLocaleDateString()}</td>
      <td data-label="Actions"><div className="qa-recordings-actions"><button type="button" title="Play recording" aria-label="Play recording" disabled={row.local_status!=='stored'||Date.parse(row.expires_at)<=Date.now()} onClick={()=>{setSelected(row);setLogs(null);}}><i className="ri-play-line"/></button>
      <button type="button" title="View access history" aria-label="View access history" onClick={()=>void audit(row)}><i className="ri-history-line"/></button>
      <button type="button" title="Delete recording" aria-label="Delete recording" disabled={busy||row.local_status==='deleted'} onClick={()=>void remove(row)}><i className="ri-delete-bin-line"/></button></div></td>
    </tr>)}</tbody></table></div>}
    <nav className="qa-recordings-pagination" aria-label="Recording pages"><button type="button" aria-label="Previous page" disabled={page===1||loading} onClick={()=>setPage(page-1)}><i className="ri-arrow-left-line"/></button><span>Page {page}</span><button type="button" aria-label="Next page" disabled={rows.length<50||loading} onClick={()=>setPage(page+1)}><i className="ri-arrow-right-line"/></button></nav>
    {selected&&<div className="qa-recordings-overlay" onClick={event=>{if(event.target===event.currentTarget)setSelected(null);}}><section className="qa-recordings-dialog" role="dialog" aria-modal="true" aria-label={logs===null?'Recording playback':'Recording access history'}>
      <header><h2>{logs===null?'Recording playback':'Access history'}</h2><button type="button" aria-label="Close recording" onClick={()=>setSelected(null)}><i className="ri-close-line"/></button></header>
      <p>{selected.booking_id}</p>{logs===null?<video key={selected.id} controls playsInline crossOrigin="use-credentials" src={playbackUrl(selected)} onError={()=>setError('Playback unavailable. Check your session and retry.')} />:<div className="qa-recordings-audit">{logs.map(log=><p><time>{new Date(log.created_at).toLocaleString()}</time> <strong>{log.action}</strong> <span>{log.admin_id}</span> <small>{log.detail}</small></p>)}{logs.length===0&&<p>No access history yet.</p>}</div>}
    </section></div>}
  </div>;
}
