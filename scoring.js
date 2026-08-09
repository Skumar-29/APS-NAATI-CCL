(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.APSScoring=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  const EN_STOP=new Set('a an the i you he she we they it this that these those my your his her our their am is are was were be been being do does did to of for and or but with from at on in as will would could should can have has had there then than please could tell me what when where how who'.split(' '));
  const HI_STOP=new Set('मैं आप वह वे हम यह ये मेरा मेरी मेरे आपका आपकी आपके उसका उसकी उसके हमारा हमारी हमारे है हैं था थी थे हो होगा होगी होंगे को से में पर और या लेकिन कि के का की एक कृपया क्या कब कहाँ कैसे कौन'.split(' '));
  const GROUPS=[
    ['licence','license','licences','licenses'],['driver','drivers','driving','motorist'],['copy','copies','photocopy','photocopies'],
    ['certify','certified','certifies','certifying','certification','attest','attested'],['passport','passports'],
    ['require','required','requires','requiring','need','needs','needed','necessary'],['submit','submitted','lodged','lodge','provide','provided','supply','supplied'],
    ['purchase','purchased','buy','bought'],['cancel','cancelled','canceled','terminate','terminated','end','ended'],
    ['assistance','support','help'],['payment','pay','paid'],['appointment','booking','meeting'],['medicine','medication','drug'],
    ['doctor','physician','gp','practitioner'],['child','children','kid','kids'],['work','job','employment'],['home','house','residence'],
    ['fee','charge','cost'],['refund','reimbursement','repayment'],['sick','ill','unwell'],['vomit','vomited','vomiting','nauseous','nausea'],
    ['lawyer','solicitor','legal','representative'],['police','officer','constable'],['bank','financial','institution'],['account','accounts'],
    ['open','opening','opened'],['close','closing','closed'],['increase','increased','rise','rose','higher'],['decrease','decreased','reduce','reduced','lower'],
    ['before','prior'],['after','following'],['must','mandatory','required'],['may','might','possibly','possible'],['cannot','cant','unable'],['not','no','never'],
    ['चिकित्सक','डॉक्टर','डाक्टर','वैद्य'],['सहायता','मदद','समर्थन'],['आवश्यक','जरूरी','ज़रूरी','अनिवार्य'],['प्रमाणित','सत्यापित','तस्दीक'],
    ['प्रतिलिपि','फोटोकॉपी','फोटोप्रति','कॉपी','प्रतियां','प्रतियाँ'],['अनुमति','इजाजत','इजाज़त'],['नियुक्ति','अपॉइंटमेंट','मुलाकात','मिलने'],
    ['रद्द','निरस्त','कैंसल'],['राशि','पैसे','धन','भुगतान'],['बीमारी','रोग','समस्या','स्थिति'],['तुरंत','तत्काल','फौरन'],
    ['अस्पताल','हॉस्पिटल'],['प्रयोगशाला','लैब'],['परीक्षण','जाँच','जांच','टेस्ट'],['लक्षण','परेशानी'],['वकील','सॉलिसिटर','अधिवक्ता'],
    ['पुलिस','अधिकारी'],['खाता','अकाउंट'],['बैंक','बैंकिंग'],['नौकरी','काम','रोजगार','रोज़गार'],['घर','मकान','आवास'],
    ['पहले','पूर्व'],['बाद','पश्चात'],['नहीं','मत','कभीनहीं'],['होसकता','संभव','शायद'],['चाहिए','आवश्यक','जरूरी','ज़रूरी'],['जानकारी','सूचना','विवरण'],['दस्तावेज़','दस्तावेज','कागज़ात','कागज','कागज़'],['आवेदन','अर्जी','एप्लीकेशन'],['प्रक्रिया','कार्यवाही','प्रोसेस'],['विकल्प','चुनाव'],['शुल्क','फीस','खर्च','लागत'],['पंजीकरण','रजिस्ट्रेशन'],['रसीद','बिल','इनवॉइस'],['किराया','भाड़ा'],['दर्द','पीड़ा','तकलीफ','तकलीफ़'],['दवा','औषधि','मेडिसिन'],['टीका','वैक्सीन','टीकाकरण'],['क्लिनिक','चिकित्सालय'],['रिपोर्ट','प्रतिवेदन'],['सलाह','परामर्श'],['मंजूरी','मंज़ूरी','स्वीकृति'],['पात्रता','योग्यता'],['रिकॉर्ड','अभिलेख'],['समझौता','सहमति'],['शिकायत','परिवाद'],['मरम्मत','सुधार'],['insurance','cover','coverage'],['document','documents','paper','papers','record','records'],['information','details','detail'],['application','apply','form'],['process','procedure','steps'],['option','options','choice','choices'],['cost','costs','fee','fees','charge','charges'],['evidence','proof','record','records'],['vaccination','immunisation','vaccine','vaccines']
  ];
  const ALIAS=new Map(); GROUPS.forEach(g=>g.forEach(w=>ALIAS.set(w,g[0])));
  const NUMBERS={
    zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20',thirty:'30',forty:'40',fifty:'50',sixty:'60',seventy:'70',eighty:'80',ninety:'90',hundred:'100',thousand:'1000',
    'शून्य':'0','एक':'1','दो':'2','तीन':'3','चार':'4','पाँच':'5','पांच':'5','छह':'6','सात':'7','आठ':'8','नौ':'9','दस':'10','ग्यारह':'11','बारह':'12','तेरह':'13','चौदह':'14','पंद्रह':'15','सोलह':'16','सत्रह':'17','अठारह':'18','उन्नीस':'19','बीस':'20','तीस':'30','चालीस':'40','पचास':'50','साठ':'60','सत्तर':'70','अस्सी':'80','नब्बे':'90','सौ':'100','हजार':'1000','हज़ार':'1000','चौबीस':'24','उनतीस':'29'
  };

  function rawTokens(text){return String(text||'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}:.-]+/gu,' ').trim().split(/\s+/).filter(Boolean);}
  function stem(w){
    if(ALIAS.has(w)) return ALIAS.get(w);
    if(NUMBERS[w]) return NUMBERS[w];
    if(/^[a-z]+$/.test(w)){
      if(w.length>5&&w.endsWith('ies'))w=w.slice(0,-3)+'y';
      else if(w.length>5&&w.endsWith('ing'))w=w.slice(0,-3);
      else if(w.length>4&&w.endsWith('ed'))w=w.slice(0,-2);
      else if(w.length>4&&w.endsWith('es'))w=w.slice(0,-2);
      else if(w.length>3&&w.endsWith('s'))w=w.slice(0,-1);
    }
    return ALIAS.get(w)||NUMBERS[w]||w;
  }
  function tokens(text,{keepStops=false}={}){
    return rawTokens(text).map(stem).filter(w=>w.length>1&&(keepStops||(!EN_STOP.has(w)&&!HI_STOP.has(w))));
  }
  function unique(arr){return [...new Set(arr)];}
  function similarity(answer,reference){
    const a=unique(tokens(answer)), r=unique(tokens(reference));
    if(!a.length||!r.length)return 0;
    const as=new Set(a), rs=new Set(r); let hit=0;
    r.forEach(x=>{if(as.has(x))hit++;});
    const recall=hit/r.length;
    let phit=0; a.forEach(x=>{if(rs.has(x))phit++;});
    const precision=phit/a.length;
    return precision+recall?2*precision*recall/(precision+recall):0;
  }
  function bestSimilarity(answer,refs){return Math.max(0,...refs.filter(Boolean).map(r=>similarity(answer,r)));}
  function normalizeCompact(text){return tokens(text,{keepStops:true}).join(' ');}
  function containsConcept(answer,concept){
    const a=new Set(tokens(answer,{keepStops:true}));
    const c=unique(tokens(concept,{keepStops:false}));
    if(!c.length)return false;
    const hits=c.filter(x=>a.has(x)).length;
    return hits>=Math.max(1,Math.ceil(c.length*.55));
  }
  function criticalMatch(answer,detail,refs){
    const value=String(detail.value||'');
    if(!value)return true;
    const compact=normalizeCompact(answer);
    const vt=tokens(value,{keepStops:true});
    if(vt.length&&vt.every(x=>compact.includes(x)))return true;
    if(detail.type==='negation')return /\b(not|no|never|cannot|cant)\b/i.test(answer)||/(नहीं|मत|कभी नहीं)/.test(answer);
    if(detail.type==='modality'){
      if(/may|might|possible/i.test(value))return /\b(may|might|could|possible|possibly|perhaps)\b/i.test(answer)||/(हो सकता|संभव|शायद)/.test(answer);
      if(/must|need|required/i.test(value))return /\b(must|need|required|have to)\b/i.test(answer)||/(चाहिए|आवश्यक|जरूरी|ज़रूरी|होगा|होगी)/.test(answer);
    }
    if(detail.type==='condition')return /\b(if|unless|when)\b/i.test(answer)||/(यदि|अगर|जब|तो)/.test(answer)||bestSimilarity(answer,refs)>.78;
    if(['number','date','time','amount','name','address'].includes(detail.type)){
      const aNums=rawTokens(answer).map(x=>NUMBERS[x]||x).filter(x=>/\d/.test(x));
      const vNums=rawTokens(value).map(x=>NUMBERS[x]||x).filter(x=>/\d/.test(x));
      if(vNums.length&&vNums.every(n=>aNums.includes(n)))return true;
    }
    return containsConcept(answer,value)||bestSimilarity(answer,refs)>.88;
  }
  function splitReference(reference,n){
    const clauses=String(reference||'').split(/[।.!?;]|\s+(?:लेकिन|और|फिर|क्योंकि|यदि|अगर|but|and|then|because|if)\s+/i).map(x=>x.trim()).filter(Boolean);
    if(clauses.length>=n)return clauses.slice(0,n);
    const ts=tokens(reference,{keepStops:true}); const size=Math.max(1,Math.ceil(ts.length/n));
    return Array.from({length:n},(_,i)=>ts.slice(i*size,(i+1)*size).join(' ')).filter(Boolean);
  }
  function assessSegment(segment,answer,delivery={}){
    const refs=[segment.model,...(segment.acceptedAlternatives||[])];
    const coverage=bestSimilarity(answer,refs);
    const critical=(segment.criticalDetails||[]).map(d=>({...d,matched:criticalMatch(answer,d,refs)}));
    const missingCritical=critical.filter(d=>!d.matched);
    const unitChunks=splitReference(segment.model,(segment.meaningUnits||[]).length||1);
    const units=(segment.meaningUnits||[]).map((u,i)=>{
      let matched=(u.acceptedConcepts||[]).some(c=>containsConcept(answer,c));
      if(!matched&&unitChunks[i])matched=similarity(answer,unitChunks[i])>=.22;
      if(!matched&&coverage>=.88)matched=true;
      return {...u,matched};
    });
    let deduction=coverage>=.86?.05:coverage>=.74?.32:coverage>=.58?.75:coverage>=.40?1.35:2.15;
    missingCritical.forEach(d=>deduction+=d.severity==='major'?.7:.35);
    const startDelay=Number(delivery.startDelay||0);
    if(startDelay>8)deduction+=.35; else if(startDelay>5)deduction+=.15;
    if(delivery.noSpeech)deduction=Math.max(deduction,2.8);
    deduction=Math.min(3.5,deduction);
    const status=deduction<=.25?'excellent':deduction<=.7?'good':deduction<=1.45?'review':'major';
    const captured=units.filter(u=>u.matched).map(u=>u.label);
    const review=units.filter(u=>!u.matched).map(u=>u.label);
    missingCritical.forEach(d=>review.push(`${d.type}: ${d.value}`));
    const strengths=[];
    if(coverage>=.8)strengths.push('Main meaning was preserved');
    if(!missingCritical.length&&critical.length)strengths.push('Critical details were preserved');
    if(startDelay&&startDelay<=5)strengths.push('Response began promptly');
    const advice=[];
    if(coverage<.74)advice.push('Replay the source and rebuild the message in short meaning groups');
    if(missingCritical.length)advice.push('Write critical names, numbers, dates, negatives and conditions immediately');
    if(startDelay>5)advice.push('Practise beginning within five seconds of the chime');
    return {coverage,deduction,status,captured,review:[...new Set(review)],critical,units,strengths,advice};
  }
  function aggregateDialogue(segmentResults,{repeats=0,previous=null}={}){
    const baseDeduction=segmentResults.reduce((s,r)=>s+r.deduction,0);
    const repeatDeduction=Math.max(0,repeats-1)*.5;
    const totalDeduction=baseDeduction+repeatDeduction;
    const midpoint=Math.max(0,Math.min(45,45-totalDeduction));
    const uncertainty=segmentResults.some(r=>r.coverage===0)?2.2:1.3;
    const low=Math.max(0,Math.floor(midpoint-uncertainty));
    const high=Math.min(45,Math.ceil(midpoint+uncertainty));
    const counts={excellent:0,good:0,review:0,major:0}; segmentResults.forEach(r=>counts[r.status]++);
    const strengths=[];
    if(counts.excellent+counts.good>=Math.ceil(segmentResults.length*.75))strengths.push('Meaning was preserved in most segments');
    if(segmentResults.every(r=>!r.critical.some(c=>!c.matched)))strengths.push('All detected critical details were preserved');
    if(repeats<=1)strengths.push('Repeat use remained within the penalty-free allowance');
    const weakLabels={}; segmentResults.forEach(r=>r.review.forEach(x=>weakLabels[x]=(weakLabels[x]||0)+1));
    const priorities=Object.entries(weakLabels).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([x])=>x);
    const improvement=previous?{previousLow:previous.low,previousHigh:previous.high,changeLow:low-previous.low,changeHigh:high-previous.high}:null;
    return {low,high,midpoint:Math.round(midpoint*10)/10,counts,strengths,priorities,repeatDeduction,improvement};
  }
  function mockPass(d1,d2){return {totalLow:d1.low+d2.low,totalHigh:d1.high+d2.high,passCertain:d1.low>=29&&d2.low>=29&&(d1.low+d2.low)>=63,passPossible:d1.high>=29&&d2.high>=29&&(d1.high+d2.high)>=63};}
  return {tokens,similarity,bestSimilarity,assessSegment,aggregateDialogue,mockPass};
});
