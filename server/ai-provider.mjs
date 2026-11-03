const PROVIDERS=Object.freeze({
  groq:{endpoint:'https://api.groq.com/openai/v1/chat/completions',model:'openai/gpt-oss-120b',keyName:'GROQ_API_KEY'},
  gemini:{endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-3.5-flash',keyName:'GEMINI_API_KEY'}
});

/** Only fixed, provider-owned endpoints are supported; never accept caller URLs. */
export function aiProvider(name='groq'){
  const value=PROVIDERS[name];if(!value)throw Error('IRON_AI_PROVIDER muss gemini oder groq sein.');
  return {name,...value};
}
export function resolveAI(options={},env=process.env){
  const name=options.provider||(env.IRON_AI_PROVIDER||'').trim()||(env.GEMINI_API_KEY?'gemini':'groq');
  const provider=aiProvider(name);
  const apiKey=options.apiKey??env[provider.keyName]??'';
  const model=options.model??env[name==='gemini'?'GEMINI_MODEL':'GROQ_MODEL']??provider.model;
  if(typeof apiKey!=='string'||typeof model!=='string'||!model.trim()||model.length>100)throw Error('Ungültige KI-Konfiguration.');
  return {...provider,apiKey,model};
}
export function completionBody(provider,payload,tokens){
  return {...payload,...(provider==='gemini'?{max_tokens:tokens}:{max_completion_tokens:tokens})};
}
export async function readProviderJSON(response,maxBytes=512000){
  const length=Number(response.headers?.get?.('content-length'));
  if(length>maxBytes)throw Error('KI-Antwort zu groß.');
  if(!response.body?.getReader){const raw=await response.text();if(Buffer.byteLength(raw)>maxBytes)throw Error('KI-Antwort zu groß.');return JSON.parse(raw);}
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>maxBytes)throw Error('KI-Antwort zu groß.');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
