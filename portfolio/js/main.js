const R=[
 {n:"Egg fried rice",i:["egg","rice","onion","oil","soy sauce"]},
 {n:"Tomato omelette",i:["egg","tomato","onion","oil"]},
 {n:"Aloo masala",i:["potato","onion","tomato","oil","spices"]},
 {n:"Paneer bhurji",i:["paneer","onion","tomato","oil","spices"]},
 {n:"Tomato rice",i:["rice","tomato","onion","oil","spices"]},
 {n:"Egg curry",i:["egg","onion","tomato","oil","spices"]}
];
const inp=document.getElementById("ing"),out=document.getElementById("out");
function run(){
  const have=inp.value.toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
  if(!have.length){out.innerHTML='<p style="color:var(--muted)">Add an ingredient to see matches.</p>';return}
  const res=R.map(r=>{const h=r.i.filter(x=>have.includes(x));return{r,h,s:h.length/r.i.length}})
    .filter(x=>x.h.length).sort((a,b)=>b.s-a.s).slice(0,4);
  out.innerHTML=res.length?res.map(x=>{
    const miss=x.r.i.filter(i=>!x.h.includes(i));
    return `<div class="match"><div>${x.r.n}<br><small>Still need: ${miss.join(", ")||"nothing"}</small></div><strong>${Math.round(x.s*100)}% match</strong></div>`
  }).join(""):'<p style="color:var(--muted)">No match yet. Try egg, rice, tomato or onion.</p>';
}
inp.addEventListener("input",run);
document.querySelectorAll(".chips button").forEach(b=>b.addEventListener("click",()=>{
  const cur=inp.value.split(",").map(s=>s.trim()).filter(Boolean);
  if(!cur.includes(b.textContent))cur.push(b.textContent);
  inp.value=cur.join(", ");run();
}));
run();

/* candle light: follows the cursor, brighter and wider the faster you move */
document.documentElement.classList.add("js");
const SEL=".hl,.card,.facts div,.certs div,.skills div,.match,.btn,.demo";
const c=document.getElementById("candle");
let mx=-999,my=-999,lx=-999,ly=-999,cx=0,cy=0,speed=0,active=null,inside=false;
const st=new Map();
document.addEventListener("pointermove",e=>{
  if(e.pointerType==="touch")return;
  mx=e.clientX;my=e.clientY;inside=true;
  speed=Math.min(speed+Math.hypot(mx-lx,my-ly)*.6,60);lx=mx;ly=my;
  active=e.target.closest?e.target.closest(SEL):null;
  if(active&&!st.has(active)){const r=active.getBoundingClientRect();st.set(active,{x:mx-r.left,y:my-r.top,gi:0})}
},{passive:true});
document.documentElement.addEventListener("mouseleave",()=>{inside=false;active=null});
function tick(){
  speed*=.93;const s=Math.min(speed/35,1);
  cx+=(mx-cx)*.14;cy+=(my-cy)*.14;
  c.style.opacity=inside?(.45+.55*s):0;
  c.style.transform=`translate(${cx}px,${cy}px) scale(${1+.5*s})`;
  st.forEach((o,el)=>{
    if(el===active){const r=el.getBoundingClientRect();o.x+=(mx-r.left-o.x)*.25;o.y+=(my-r.top-o.y)*.25}
    o.gi+=((el===active?.55+.45*s:0)-o.gi)*.16;
    el.style.setProperty("--mx",o.x+"px");el.style.setProperty("--my",o.y+"px");
    el.style.setProperty("--gi",o.gi.toFixed(3));el.style.setProperty("--gr",(190+140*s)+"px");
    if(o.gi<.005&&el!==active){el.style.removeProperty("--gi");st.delete(el)}
  });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){const t=x.target;t.classList.add("in");io.unobserve(t);setTimeout(()=>{t.classList.remove("rv","in");t.style.transitionDelay=""},1100)}}),{threshold:.12});
document.querySelectorAll("section:not(.hero) h2,section:not(.hero) .lead,.demo,.projects .card,.skills>div,.tl>div,.certs>div,.mail,.contact .cta").forEach((el,i)=>{
  el.classList.add("rv");el.style.transitionDelay=((i%4)*70)+"ms";io.observe(el)});

/* mobile menu */
const menu=document.querySelector(".menu"),links=document.querySelector("nav ul");
menu.addEventListener("click",()=>{const o=links.classList.toggle("open");menu.setAttribute("aria-expanded",o)});
links.addEventListener("click",e=>{if(e.target.tagName==="A"){links.classList.remove("open");menu.setAttribute("aria-expanded",false)}});

