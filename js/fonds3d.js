/* MESA : fonds en 3D calculés par la carte graphique (WebGL) pour les visuels Bande-annonce, Plateau et Motion.
   Optimisé pour presque toutes les machines : dessin en petite taille puis agrandi, 30 images par seconde au plus,
   rien quand la scène n'est pas à l'écran, finesse qui baisse toute seule si l'ordinateur peine, image fixe en dernier recours.
   Seules les couleurs du thème (--accent) entrent dans le calcul. */
'use strict';

const FONDS3D_COMMUN = `precision mediump float;
uniform vec2 R; uniform float T; uniform vec3 A; uniform float F; uniform float E;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float bruit(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*bruit(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
vec3 finition(vec3 c, vec2 p){
  c*=1.-.5*dot(p*vec2(.75,1.15),p*vec2(.75,1.15));
  c=1.-exp(-c*1.5);
  c+=(h21(gl_FragCoord.xy+fract(T*7.)*91.)-.5)*.035;
  return c; }
`;
const FONDS3D = {
/* A : brume, faisceaux volumétriques, poussière, reflet anamorphique */
a: `
void main(){
  vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 chaud=mix(vec3(1.,.92,.78),A,.4);
  vec3 c=mix(vec3(.004,.006,.012),vec3(.016,.022,.04),uv.y);
  c+=A*.35*exp(-pow((p.y+.62)*3.2,2.))*(1.-abs(p.x)*.5);
  float f=fbm(vec2(p.x*1.3+T*.035,p.y*1.8-T*.015)*2.2);
  float f2=fbm(vec2(p.x*2.6-T*.06,p.y*2.4+T*.02)*1.6+5.);
  float brume=pow(f*f2*2.,1.6)*1.6;
  float fx=0.;
  for(int i=0;i<3;i++){
    float k=float(i);
    vec2 src=vec2(-.78+k*.78,.66);
    float ang=(k-1.)*.38+sin(T*.22+k*2.1)*.13;
    vec2 dir=vec2(sin(ang),-cos(ang));
    vec2 d=p-src; float le=dot(d,dir); vec2 pe=d-le*dir;
    float w=.006+le*.11;
    float b=smoothstep(w,w*.15,length(pe))*smoothstep(0.,.12,le)*exp(-le*.75);
    fx+=b*(i==1?.55:1.);
  }
  c+=chaud*fx*(.18+brume*1.15)*E;
  c+=vec3(.45,.55,.8)*.07*f*E;
  for(int l=0;l<3;l++){
    float k=float(l), sc=5.+k*6.;
    vec2 q=p*sc+vec2(T*.03*(k+1.),-T*.06*(1.+k*.4))+k*7.3;
    vec2 id=floor(q), gv=fract(q)-.5;
    float hh=h21(id+k*17.);
    vec2 o=vec2(h21(id+3.1),h21(id+7.7))-.5;
    float r=length(gv-o*.6);
    float taille=.03+.09*hh*(1.-k*.28);
    float flou=l==0?.15:.75;
    float g=smoothstep(taille,taille*flou,r)*step(.72,hh);
    c+=chaud*g*(.12+fx*1.6+brume*.2)*(l==0?.45:.8);
  }
  float ph=fract(T/9.), m=smoothstep(.3,.95,ph);
  float x=mix(-1.3,1.3,m), a=sin(3.1416*m);
  float fy=.105;
  float trait=exp(-abs(p.y-fy)*140.)*exp(-abs(p.x-x)*1.1)*a;
  float large=exp(-abs(p.y-fy)*22.)*exp(-abs(p.x-x)*2.5)*a;
  float coeur=exp(-length(p-vec2(x,fy))*16.)*a;
  c+=vec3(.42,.66,1.)*(trait*1.6+large*.25)*E+vec3(1.)*coeur*.9*E;
  for(int g=1;g<4;g++){ float k=float(g); vec2 gp=vec2(-x*(.3*k),fy-(.05*k)); float rr=abs(length(p-gp)-.03*k);
    c+=mix(vec3(.4,.6,1.),A,k/3.)*exp(-rr*90.)*a*.18*E; }
  c=finition(c*F,p);
  gl_FragColor=vec4(c,1.);
}`,
/* B : studio 3D, mur LED émissif, sol réfléchissant, colonnes de lumière */
b: `
vec3 mur(vec2 w, float flou){
  if(abs(w.x)>9.5||w.y<0.||w.y>6.) return vec3(0.);
  vec3 base=mix(vec3(.01,.02,.05),A*.25+vec3(.02,.03,.08),smoothstep(0.,6.,w.y));
  float b=fract(w.x*.11+w.y*.06-T*.12);
  float bandes=smoothstep(.0,.03,b)*smoothstep(.32,.29,b);
  float b2=fract(w.x*.11+w.y*.06-T*.12+.5);
  float fines=smoothstep(.0,.01,b2)*smoothstep(.05,.04,b2);
  vec3 col=base+A*bandes*.28+vec3(.5,.7,1.)*fines*.22;
  col+=A*1.2*exp(-length(w-vec2(sin(T*.31)*5.,3.2))*.6);
  col+=vec3(.6,.75,1.)*.5*exp(-length(w-vec2(cos(T*.23)*6.,1.6))*.8);
  vec2 g=fract(w*vec2(20.,20.))-.5;
  float pix=smoothstep(.48,.28,max(abs(g.x),abs(g.y)));
  col*=mix(.45+.75*pix,1.,flou)*.7;
  col*=smoothstep(9.5,9.,abs(w.x))*smoothstep(0.,.15,w.y);
  return col;
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 ro=vec3(sin(T*.11)*1.6,1.65+sin(T*.17)*.12,-7.);
  vec3 ta=vec3(0.,1.6,0.);
  vec3 ww=normalize(ta-ro), uu=normalize(cross(vec3(0,1,0),ww)), vv=cross(ww,uu);
  vec3 rd=normalize(p.x*uu+p.y*vv+1.55*ww);
  vec3 c=vec3(.004,.006,.014);
  float zw=6.;
  float tw=(zw-ro.z)/rd.z;
  float tf=rd.y<0.?-ro.y/rd.y:1e9;
  if(tf<tw){
    vec3 pos=ro+rd*tf;
    vec2 gg=abs(fract(pos.xz*.5)-.5);
    float ligne=smoothstep(.025,0.,min(gg.x,gg.y));
    float loin=exp(-tf*.06);
    vec3 rr=reflect(rd,vec3(0,1,0));
    rr.xz+=(vec2(bruit(pos.xz*6.),bruit(pos.xz*6.+9.))-.5)*.02;
    float t2=(zw-pos.z)/rr.z;
    vec3 wp=pos+rr*t2;
    float fres=.25+.75*pow(1.-max(dot(-rd,vec3(0,1,0)),0.),4.);
    c=vec3(.006,.008,.016)+mur(wp.xy,1.)*fres*.75*E;
    c+=A*ligne*.55*loin*(.5+.5*smoothstep(10.,0.,abs(pos.x)));
    c*=loin*1.2+.15;
  } else if(tw>0.){
    vec3 wp=ro+rd*tw;
    c=mur(wp.xy,0.)*E;
  }
  for(int i=0;i<2;i++){
    vec2 col2=vec2(i==0?-7.:7.,3.5);
    vec2 dxz=rd.xz; vec2 o=ro.xz;
    float t=dot(col2-o,dxz)/dot(dxz,dxz);
    float d=length(o+dxz*t-col2);
    float y=ro.y+rd.y*t;
    float lum=.0035/(d*d+.0025)*smoothstep(6.5,5.5,y)*smoothstep(-.2,.3,y);
    if(t>0.&&t<tf) c+=mix(A,vec3(1.),.35)*lum*.35*E;
  }
  float s=fract((p.x+p.y*.45)*.6-T*.16);
  c+=A*.08*smoothstep(.0,.05,s)*smoothstep(.12,.06,s)*E;
  c+=A*.06*exp(-abs(p.y+.02)*6.);
  c=finition(c*F,p);
  gl_FragColor=vec4(c,1.);
}`,
/* C : métal liquide (gouttes qui fusionnent), reflets irisés */
c: `
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float carte(vec3 q){
  float d=1e5;
  for(int i=0;i<5;i++){
    float k=float(i);
    vec3 cc=vec3(sin(T*.37+k*1.9)*1.7+(k-2.)*.45, cos(T*.29+k*2.6)*.9, sin(T*.23+k*1.3)*.7);
    d=smin(d,length(q-cc)-(.5+.16*sin(k*3.7)),1.15);
  }
  return d;
}
vec3 normale(vec3 q){ vec2 e=vec2(.002,0.); return normalize(vec3(carte(q+e.xyy)-carte(q-e.xyy),carte(q+e.yxy)-carte(q-e.yxy),carte(q+e.yyx)-carte(q-e.yyx))); }
vec3 env(vec3 d){
  vec3 c=mix(vec3(.03,.025,.06),vec3(.75,.78,.9),smoothstep(-.2,1.,d.y));
  c=mix(c,c*(A*1.2+.25),.55);
  c+=vec3(1.)*smoothstep(.9,.97,sin(d.x*3.+T*.25)*.5+.5)*smoothstep(-.2,.6,d.y)*1.6;
  c+=vec3(1.)*smoothstep(.85,.95,sin(d.y*5.-1.)*.5+.5)*.5;
  c+=A.zxy*.6*exp(-length(d.xy-vec2(-.7,.2))*2.);
  c+=A*1.1*exp(-length(d.xy-vec2(.8,-.1))*2.4);
  return c;
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 c=vec3(.025,.018,.05);
  c+=A*.55*exp(-length(p-vec2(-.6+sin(T*.2)*.15,.35))*2.2);
  c+=A.zxy*.35*exp(-length(p-vec2(.7,-.3+cos(T*.17)*.1))*2.);
  c+=A.yzx*.25*exp(-length(p-vec2(.1,-.55))*2.6);
  vec3 ro=vec3(0.,0.,-5.4), rd=normalize(vec3(p,1.65));
  float t=0., d=1., dm=1e5, tm=0.;
  for(int i=0;i<56;i++){ vec3 q=ro+rd*t; d=carte(q); if(d<dm){ dm=d; tm=t; } if(d<.002||t>9.) break; t+=d*.95; }
  float px=2.2/R.y*tm;
  float cov=1.-smoothstep(0.,px,dm);
  if(cov>0.){
    vec3 q=ro+rd*tm, n=normale(q), r=reflect(rd,n);
    float fr=pow(1.+dot(rd,n),4.);
    vec3 iri=.5+.5*cos(6.2832*(fr*.9+vec3(0.,.33,.67))+T*.3);
    vec3 m=env(r)*(.75+.25*iri)+iri*fr*.35;
    m+=pow(max(dot(r,normalize(vec3(.5,.8,-.6))),0.),70.)*1.6;
    m*=.65+.35*max(n.y,0.)+.2;
    c=mix(c,m,E*cov);
  }
  c=finition(c*F,p);
  gl_FragColor=vec4(c,1.);
}`
};
const FONDS3D_VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';

/* ----- Le moteur : un seul rythme pour tous les fonds de la page ----- */
const FONDS3D_ACTIFS = [];
const FONDS3D_PAS = 1000 / 30;                 // 30 images par seconde suffisent pour un fond
const FONDS3D_CLE = 'obseb:materiel3d';
let fonds3dT0 = performance.now(), fonds3dAvant = 0, fonds3dBoucle = false;

function fonds3dCouleur(el) {
  const v = getComputedStyle(el).getPropertyValue('--accent').trim() || '#FFD21F';
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (!m) return [1, .82, .12];
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function fonds3dProgramme(gl, fx) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, FONDS3D_VERT), fs = sh(gl.FRAGMENT_SHADER, FONDS3D_COMMUN + FONDS3D[fx]);
  if (!vs || !fs) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const la = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  return { uR: U('R'), uT: U('T'), uA: U('A'), uF: U('F'), uE: U('E') };
}
/* Lance un fond sur un <canvas>. Renvoie false si la carte graphique ne suit pas (le CSS de repli reste alors visible). */
function lancerFond3D(cv, fx, force = 1) {
  if (!cv || !FONDS3D[fx]) return false;
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return false;
  const u = fonds3dProgramme(gl, fx);
  if (!u) return false;
  // finesse de départ : le fond est dessiné en petit puis agrandi (un fond doux n'a pas besoin de 1080p)
  const f = { cv, gl, u, fx, force, echelle: fx === 'c' ? .3 : .38, temps: [], fige: false, couleur: fonds3dCouleur(cv), vu: 0 };
  FONDS3D_ACTIFS.push(f);
  cv.classList.add('actif');
  if (!fonds3dBoucle) { fonds3dBoucle = true; requestAnimationFrame(fonds3dTour); setInterval(fonds3dAjuster, 2000); }
  return true;
}
function fonds3dVisible(f) {
  if (!f.cv.isConnected) return false;
  if (f.cv.closest('.cachee')) return false;          // scène pas à l'écran
  return f.cv.offsetWidth > 0;
}
function fonds3dTour(now) {
  requestAnimationFrame(fonds3dTour);
  if (document.hidden || now - fonds3dAvant < FONDS3D_PAS - 2) return;
  fonds3dAvant = now;
  const T = (now - fonds3dT0) / 1000;
  for (let i = FONDS3D_ACTIFS.length - 1; i >= 0; i--) {
    const f = FONDS3D_ACTIFS[i];
    if (!f.cv.isConnected) { const e = f.gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); FONDS3D_ACTIFS.splice(i, 1); continue; }
    if (f.fige || !fonds3dVisible(f)) continue;
    // taille réelle à l'écran × finesse (la page est mise à l'échelle : on se base sur ce qui est vraiment affiché)
    const r = f.cv.getBoundingClientRect();
    const w = Math.max(160, Math.min(1280, Math.round(r.width * Math.min(devicePixelRatio || 1, 2) * f.echelle)));
    const h = Math.max(90, Math.round(w * r.height / Math.max(1, r.width)));
    if (f.cv.width !== w || f.cv.height !== h) { f.cv.width = w; f.cv.height = h; }
    const gl = f.gl, t1 = performance.now();
    gl.viewport(0, 0, w, h);
    gl.uniform2f(f.u.uR, w, h); gl.uniform1f(f.u.uT, T);
    gl.uniform3f(f.u.uA, f.couleur[0], f.couleur[1], f.couleur[2]);
    gl.uniform1f(f.u.uF, .65 + .35 * f.force); gl.uniform1f(f.u.uE, f.force);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    f.temps.push(performance.now() - t1);
  }
}
/* Toutes les 2 s : trop lent → moins fin ; toujours trop lent au plus bas → image fixe. Assez rapide → un peu plus fin. */
function fonds3dAjuster() {
  for (const f of FONDS3D_ACTIFS) {
    f.couleur = fonds3dCouleur(f.cv);
    if (f.temps.length < 5) continue;
    const moy = f.temps.reduce((a, b) => a + b, 0) / f.temps.length; f.temps = [];
    if (moy > 9 && f.echelle > .18) f.echelle = Math.max(.18, f.echelle * .8);
    else if (moy > 14) { f.fige = true; f.cv.classList.add('fige'); }
    else if (moy < 3 && f.echelle < .5) f.echelle = Math.min(.5, f.echelle * 1.1);
  }
}

/* ----- Test du matériel (au clic sur « Nouveau live ») : la carte graphique suit-elle ? ----- */
function resultatMateriel3D() {
  try { const r = JSON.parse(localStorage.getItem(FONDS3D_CLE) || 'null'); return r && typeof r.ok === 'boolean' ? r : null; } catch (e) { return null; }
}
/* Les visuels 3D sont proposés si le test est bon, ou s'il n'a pas encore été fait et que WebGL existe */
function fonds3dDispo() {
  const r = resultatMateriel3D();
  if (r) return r.ok;
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl'); } catch (e) { return false; }
}
function testerMateriel3D() {
  return new Promise(fin => {
    const garder = r => { try { localStorage.setItem(FONDS3D_CLE, JSON.stringify(Object.assign(r, { quand: Date.now() }))); } catch (e) {} fin(r); };
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return garder({ ok: false, raison: 'webgl' });
    const u = fonds3dProgramme(gl, 'c');                 // le plus lourd des trois
    if (!u) return garder({ ok: false, raison: 'shader' });
    gl.viewport(0, 0, 480, 270); gl.uniform2f(u.uR, 480, 270); gl.uniform3f(u.uA, 1, .82, .12); gl.uniform1f(u.uF, 1); gl.uniform1f(u.uE, 1);
    const px = new Uint8Array(4);
    const dessin = t => { gl.uniform1f(u.uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    dessin(0);                                           // la première image compte la mise en route, on l'écarte
    const t0 = performance.now();
    for (let i = 1; i <= 8; i++) dessin(i * .2);
    const ms = (performance.now() - t0) / 8;
    const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext();
    // 480×270 ≈ la taille d'un fond en finesse moyenne : moins de 12 ms laisse de la marge à 30 images par seconde
    garder({ ok: ms < 12, ms: Math.round(ms * 10) / 10, raison: ms < 12 ? '' : 'lent' });
  });
}
