/* Núcleo CSG y biblioteca de ensambles, tomados de «Ensambles de carpintería 3D» (Eloi A.A., EUPL-1.2).
   Se regenera con herramientas_desarrollo/extraer_ensambles.py: no editar a mano. */
/* ===== Núcleo CSG (basado en csg.js de Evan Wallace, licencia MIT) ===== */
var CSG = (function(){
  var EPS = 1e-5;
  function Vec(x,y,z){ this.x=x; this.y=y; this.z=z; }
  Vec.prototype = {
    clone:function(){ return new Vec(this.x,this.y,this.z); },
    neg:function(){ return new Vec(-this.x,-this.y,-this.z); },
    plus:function(a){ return new Vec(this.x+a.x,this.y+a.y,this.z+a.z); },
    minus:function(a){ return new Vec(this.x-a.x,this.y-a.y,this.z-a.z); },
    times:function(k){ return new Vec(this.x*k,this.y*k,this.z*k); },
    dot:function(a){ return this.x*a.x+this.y*a.y+this.z*a.z; },
    lerp:function(a,t){ return this.plus(a.minus(this).times(t)); },
    len:function(){ return Math.sqrt(this.dot(this)); },
    unit:function(){ return this.times(1/this.len()); },
    cross:function(a){ return new Vec(this.y*a.z-this.z*a.y, this.z*a.x-this.x*a.z, this.x*a.y-this.y*a.x); }
  };
  function Vert(p,n){ this.pos=p; this.normal=n; }
  Vert.prototype = {
    clone:function(){ return new Vert(this.pos.clone(), this.normal.clone()); },
    flip:function(){ this.normal=this.normal.neg(); },
    interp:function(o,t){ return new Vert(this.pos.lerp(o.pos,t), this.normal.lerp(o.normal,t)); }
  };
  function Plane(n,w){ this.normal=n; this.w=w; }
  Plane.fromPoints=function(a,b,c){ var n=b.minus(a).cross(c.minus(a)).unit(); return new Plane(n,n.dot(a)); };
  Plane.prototype = {
    clone:function(){ return new Plane(this.normal.clone(), this.w); },
    flip:function(){ this.normal=this.normal.neg(); this.w=-this.w; },
    split:function(poly,cf,cb,f,b){
      var COP=0,FR=1,BA=2,SP=3, pt=0, types=[], i;
      for(i=0;i<poly.verts.length;i++){
        var t=this.normal.dot(poly.verts[i].pos)-this.w;
        var ty = t<-EPS?BA:(t>EPS?FR:COP); pt|=ty; types.push(ty);
      }
      if(pt===COP){ (this.normal.dot(poly.plane.normal)>0?cf:cb).push(poly); }
      else if(pt===FR){ f.push(poly); }
      else if(pt===BA){ b.push(poly); }
      else {
        var fs=[], bs=[];
        for(i=0;i<poly.verts.length;i++){
          var j=(i+1)%poly.verts.length, ti=types[i], tj=types[j], vi=poly.verts[i], vj=poly.verts[j];
          if(ti!==BA) fs.push(vi);
          if(ti!==FR) bs.push(ti!==BA?vi.clone():vi);
          if((ti|tj)===SP){
            var tt=(this.w-this.normal.dot(vi.pos))/this.normal.dot(vj.pos.minus(vi.pos));
            var v=vi.interp(vj,tt); fs.push(v); bs.push(v.clone());
          }
        }
        if(fs.length>=3) f.push(new Poly(fs,poly.plane));
        if(bs.length>=3) b.push(new Poly(bs,poly.plane));
      }
    }
  };
  function newell(verts){ // normal robusta aunque haya vértices alineados
    var nx=0,ny=0,nz=0;
    for(var i=0;i<verts.length;i++){ var a=verts[i].pos, b=verts[(i+1)%verts.length].pos;
      nx+=(a.y-b.y)*(a.z+b.z); ny+=(a.z-b.z)*(a.x+b.x); nz+=(a.x-b.x)*(a.y+b.y); }
    var n=new Vec(nx,ny,nz).unit(); return new Plane(n, n.dot(verts[0].pos));
  }
  function Poly(verts,plane){ this.verts=verts; this.plane = plane ? plane.clone() : newell(verts); }
  Poly.prototype = {
    clone:function(){ return new Poly(this.verts.map(function(v){return v.clone();}), this.plane); },
    flip:function(){ this.verts.reverse().forEach(function(v){v.flip();}); this.plane.flip(); }
  };
  function Node(polys){ this.plane=null; this.front=null; this.back=null; this.polys=[]; if(polys) this.build(polys); }
  Node.prototype = {
    invert:function(){
      for(var i=0;i<this.polys.length;i++) this.polys[i].flip();
      if(this.plane) this.plane.flip();
      if(this.front) this.front.invert(); if(this.back) this.back.invert();
      var t=this.front; this.front=this.back; this.back=t;
    },
    clipPolys:function(polys){
      if(!this.plane) return polys.slice();
      var f=[], b=[];
      for(var i=0;i<polys.length;i++) this.plane.split(polys[i],f,b,f,b);
      if(this.front) f=this.front.clipPolys(f);
      b = this.back ? this.back.clipPolys(b) : [];
      return f.concat(b);
    },
    clipTo:function(bsp){
      this.polys=bsp.clipPolys(this.polys);
      if(this.front) this.front.clipTo(bsp); if(this.back) this.back.clipTo(bsp);
    },
    all:function(){
      var p=this.polys.slice();
      if(this.front) p=p.concat(this.front.all()); if(this.back) p=p.concat(this.back.all());
      return p;
    },
    build:function(polys){
      if(!polys.length) return;
      if(!this.plane) this.plane=polys[0].plane.clone();
      var f=[], b=[];
      for(var i=0;i<polys.length;i++) this.plane.split(polys[i],this.polys,this.polys,f,b);
      if(f.length){ if(!this.front) this.front=new Node(); this.front.build(f); }
      if(b.length){ if(!this.back) this.back=new Node(); this.back.build(b); }
    }
  };
  function Solid(polys){ this.polys=polys||[]; }
  Solid.prototype = {
    clone:function(){ return new Solid(this.polys.map(function(p){return p.clone();})); },
    union:function(o){
      var a=new Node(this.clone().polys), b=new Node(o.clone().polys);
      a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all());
      return new Solid(a.all());
    },
    intersect:function(o){
      var a=new Node(this.clone().polys), b=new Node(o.clone().polys);
      a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.all()); a.invert();
      return new Solid(a.all());
    },
    subtract:function(o){
      var a=new Node(this.clone().polys), b=new Node(o.clone().polys);
      a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.all()); a.invert();
      return new Solid(a.all());
    }
  };

  // ----- Primitivas -----
  // Ejes: un perfil 2D (u,v) se extruye a lo largo de w
  function map(axis,u,v,w){ return axis==='x'?new Vec(w,u,v):axis==='y'?new Vec(u,w,v):new Vec(u,v,w); }
  function face(pts, hint, normals){ // pts: Vec[], hint: dirección exterior
    var verts=pts.map(function(p,i){ return new Vert(p, normals?normals[i]:new Vec(0,0,0)); });
    var poly=new Poly(verts);
    if(poly.plane.normal.dot(hint)<0){ verts.reverse(); if(normals) normals.reverse(); poly=new Poly(verts); }
    if(!normals) verts.forEach(function(v){ v.normal=poly.plane.normal.clone(); });
    return poly;
  }
  // prisma de perfil convexo (lista [[u,v],...]) a lo largo de "axis" entre w0 y w1
  function prism(axis, prof, w0, w1){
    var polys=[], n=prof.length, cu=0, cv=0, i;
    prof.forEach(function(p){ cu+=p[0]/n; cv+=p[1]/n; });
    var ax = map(axis,0,0,1);
    polys.push(face(prof.map(function(p){return map(axis,p[0],p[1],w1);}), ax));
    polys.push(face(prof.map(function(p){return map(axis,p[0],p[1],w0);}), ax.neg()));
    for(i=0;i<n;i++){
      var a=prof[i], b=prof[(i+1)%n];
      var hint=map(axis,(a[0]+b[0])/2-cu,(a[1]+b[1])/2-cv,0);
      polys.push(face([map(axis,a[0],a[1],w0),map(axis,b[0],b[1],w0),map(axis,b[0],b[1],w1),map(axis,a[0],a[1],w1)], hint));
    }
    return new Solid(polys);
  }
  function box(x0,y0,z0,x1,y1,z1){
    return prism('z',[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],z0,z1);
  }
  function cylinder(axis, cu, cv, r, w0, w1, slices){
    slices = slices||32;
    var polys=[], top=[], bot=[], ax=map(axis,0,0,1), i;
    for(i=0;i<slices;i++){
      var a0=i/slices*Math.PI*2, a1=(i+1)/slices*Math.PI*2;
      var n0=map(axis,Math.cos(a0),Math.sin(a0),0), n1=map(axis,Math.cos(a1),Math.sin(a1),0);
      var p00=map(axis,cu+r*Math.cos(a0),cv+r*Math.sin(a0),w0), p10=map(axis,cu+r*Math.cos(a1),cv+r*Math.sin(a1),w0);
      var p11=map(axis,cu+r*Math.cos(a1),cv+r*Math.sin(a1),w1), p01=map(axis,cu+r*Math.cos(a0),cv+r*Math.sin(a0),w1);
      var mid=map(axis,Math.cos((a0+a1)/2),Math.sin((a0+a1)/2),0);
      polys.push(face([p00,p10,p11,p01], mid, [n0,n1,n1.clone(),n0.clone()]));
      top.push(p01); bot.push(p00);
    }
    polys.push(face(top, ax)); polys.push(face(bot, ax.neg()));
    return new Solid(polys);
  }
  function subtractAll(s, list){ for(var i=0;i<list.length;i++) s=s.subtract(list[i]); return s; }

  // ----- Salida: triángulos + aristas vivas -----
  function toArrays(solid){
    var pos=[], nor=[];
    solid.polys.forEach(function(p){
      for(var i=2;i<p.verts.length;i++){
        [p.verts[0],p.verts[i-1],p.verts[i]].forEach(function(v){
          pos.push(v.pos.x,v.pos.y,v.pos.z);
          var n=v.normal, l=n.len()||1; nor.push(n.x/l,n.y/l,n.z/l);
        });
      }
    });
    return {pos:pos, nor:nor};
  }
  // Segmentos de arista con las normales de las caras que los comparten (resuelve uniones en T de la CSG)
  function edgeSegs(solid){
    var Q=1000;
    function key(v){ return Math.round(v.x*Q)+','+Math.round(v.y*Q)+','+Math.round(v.z*Q); }
    var vmap={}, vlist=[];
    solid.polys.forEach(function(p){ p.verts.forEach(function(v){ var k=key(v.pos); if(!vmap[k]){ vmap[k]=1; vlist.push(v.pos); } }); });
    var segs={}, out=[];
    solid.polys.forEach(function(p){
      var n=p.plane.normal, vs=p.verts;
      for(var i=0;i<vs.length;i++){
        var a=vs[i].pos, b=vs[(i+1)%vs.length].pos, ab=b.minus(a), L2=ab.dot(ab);
        if(L2<1e-8) continue;
        var mnx=Math.min(a.x,b.x)-1e-3, mxx=Math.max(a.x,b.x)+1e-3, mny=Math.min(a.y,b.y)-1e-3, mxy=Math.max(a.y,b.y)+1e-3, mnz=Math.min(a.z,b.z)-1e-3, mxz=Math.max(a.z,b.z)+1e-3;
        var ts=[0,1];
        for(var j=0;j<vlist.length;j++){
          var v=vlist[j];
          if(v.x<mnx||v.x>mxx||v.y<mny||v.y>mxy||v.z<mnz||v.z>mxz) continue;
          var av=v.minus(a), t=av.dot(ab)/L2;
          if(t<=1e-6||t>=1-1e-6) continue;
          var perp=av.minus(ab.times(t));
          if(perp.dot(perp)<1e-6) ts.push(t);
        }
        ts.sort(function(x,y){return x-y;});
        for(var k=0;k<ts.length-1;k++){
          if(ts[k+1]-ts[k]<1e-7) continue;
          var p0=a.plus(ab.times(ts[k])), p1=a.plus(ab.times(ts[k+1])), k0=key(p0), k1=key(p1);
          if(k0===k1) continue;
          var kk = k0<k1 ? k0+'|'+k1 : k1+'|'+k0;
          var e=segs[kk]; if(!e){ e=segs[kk]={a:p0,b:p1,ns:[]}; out.push(e); }
          e.ns.push(n);
        }
      }
    });
    return out;
  }
  function isFeature(e,cosT){
    if(e.ns.length<2) return true;
    for(var i=1;i<e.ns.length;i++) if(e.ns[0].dot(e.ns[i])<cosT) return true;
    return false;
  }
  function edges(solid, angleDeg){
    var cosT=Math.cos((angleDeg||20)*Math.PI/180), out=[];
    edgeSegs(solid).forEach(function(e){ if(isFeature(e,cosT)) out.push(e.a.x,e.a.y,e.a.z,e.b.x,e.b.y,e.b.z); });
    return out;
  }
  // Transformación rígida: rot = matriz 3x3 (filas), tr = traslación
  function transform(solid, R, tr){
    function ap(v,t){ return new Vec(R[0][0]*v.x+R[0][1]*v.y+R[0][2]*v.z+(t?t[0]:0), R[1][0]*v.x+R[1][1]*v.y+R[1][2]*v.z+(t?t[1]:0), R[2][0]*v.x+R[2][1]*v.y+R[2][2]*v.z+(t?t[2]:0)); }
    return new Solid(solid.polys.map(function(p){
      return new Poly(p.verts.map(function(v){ return new Vert(ap(v.pos,tr), ap(v.normal,null)); }));
    }));
  }
  function rotMatrix(axis, deg){
    var a=deg*Math.PI/180, c=Math.round(Math.cos(a)*1e12)/1e12, s=Math.round(Math.sin(a)*1e12)/1e12;
    if(axis==='x') return [[1,0,0],[0,c,-s],[0,s,c]];
    if(axis==='y') return [[c,0,s],[0,1,0],[-s,0,c]];
    return [[c,-s,0],[s,c,0],[0,0,1]];
  }
  function unionAll(list){ var s=list[0]; for(var i=1;i<list.length;i++) s=s.union(list[i]); return s; }
  return {Vec:Vec, box:box, prism:prism, cylinder:cylinder, subtractAll:subtractAll, unionAll:unionAll, toArrays:toArrays, edges:edges, edgeSegs:edgeSegs, isFeature:isFeature, transform:transform, rotMatrix:rotMatrix};
})();


/* ===== Biblioteca de ensambles =====
   Cada ensamble define sus medidas (params), comprobaciones y piezas.
   Pieza: {name, wood, solid, dir:[x,y,z], dist, phase:[ini,fin], num, qty, drawSkip, draw:{rot:[[eje,grados]], views:['A','P','L']}}
   Los mismos datos generan el visor 3D y las láminas del cuaderno. */
var WOOD = {
  dark:{color:0x8f6136, cut:0x5a3a1f, css:'#8f6136'},
  light:{color:0xe2c08b, cut:0xb08a52, css:'#e2c08b'},
  mid:{color:0xc0874a, cut:0x82552a, css:'#c0874a'},
  dowel:{color:0xf0dca8, cut:0xbfa66a, css:'#f0dca8'},
  ply:{color:0xd8c9a3, cut:0x9e8c62, css:'#d8c9a3'}
};
function num(x,d){ var k=Math.pow(10,d===undefined?1:d); return (Math.round(x*k)/k).toString().replace('.',','); }
var B=CSG.box, PR=CSG.prism;
var ROTZ=[['z',-90]], ROTY=[['y',90]];

/* Piezas de bastidor 45 × 24 (como el cuaderno) */
function frameParams(extra){
  return [{g:'Listones'},
    {k:'W',sym:'A',label:'Ancho',v:45,min:20,max:120},
    {k:'T',sym:'G',label:'Grueso',v:24,min:12,max:60}].concat(extra||[]);
}

var JOINTS = [
/* 1 ─────────────────────────────────────────────── */
{
  id:'horquilla', num:1, name:'Ensamble de horquilla en esquina', en:'Corner bridle joint', book:10,
  short:'Esquina de bastidor con horquilla abierta',
  desc:'Una pieza lleva una horquilla abierta (ranura en la testa) y la otra una espiga con los dos costados rebajados. Muy usada en esquinas de bastidores.',
  steps:['Se marcan los tercios del grueso con el gramil.','Se sierra y vacía la horquilla en la pieza 1.','Se sierran los costados de la espiga en la pieza 2.','La espiga entra en la horquilla deslizando en vertical.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:180,min:80,max:500},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500},
    {g:'Horquilla'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:40}]),
  validate:function(p){ if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; if(p.W*2>=p.L1||p.W*2>=p.L2) return 'Las piezas son demasiado cortas.'; return ''; },
  check:function(p){ var ok=Math.abs(p.e-p.T/3)<=1.5; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Horquilla',p.e+' × '+p.W+' mm de profundidad'],['Costados',num((p.T-p.e)/2)+' mm cada uno']]; },
  build:function(p){
    var a=(p.T-p.e)/2, b=(p.T+p.e)/2;
    var p1=B(0,0,0,p.L1,p.W,p.T).subtract(B(-1,-1,a,p.W,p.W+1,b));
    var p2=CSG.subtractAll(B(0,0,0,p.W,p.L2,p.T),[B(-1,-1,-1,p.W+1,p.W,a),B(-1,-1,b,p.W+1,p.W,p.T+1)]);
    return [
      {num:1,name:'Pieza con horquilla',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con espiga',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:p.W+60,phase:[0,1],draw:{rot:ROTZ}}];
  }
},
/* 2 */
{
  id:'horquillaT', num:2, name:'Ensamble de horquilla en T', en:'T-bridle joint', book:29,
  short:'Travesaño intermedio con horquilla',
  desc:'La pieza 1 se rebaja por las dos caras en la zona del cruce y la pieza 2 lleva una horquilla abierta que abraza ese rebaje.',
  steps:['Se marca la zona del cruce con el ancho real de la pieza 2.','Se rebajan las dos caras de la pieza 1 hasta dejar el tercio central.','Se sierra y vacía la horquilla de la pieza 2.','La horquilla baja sobre el rebaje.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:230,min:100,max:600},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500},
    {g:'Horquilla'},{k:'e',sym:'e',label:'Grueso central',v:8,min:3,max:40}]),
  validate:function(p){ if(p.e>=p.T-4) return 'El grueso central (e) debe ser menor que el grueso.'; if(p.W+40>=p.L1) return 'La pieza 1 es demasiado corta.'; return ''; },
  check:function(p){ var ok=Math.abs(p.e-p.T/3)<=1.5; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Rebaje en la pieza 1',p.W+' mm de largo · '+num((p.T-p.e)/2)+' mm por cara']]; },
  build:function(p){
    var a=(p.T-p.e)/2, b=(p.T+p.e)/2, c=p.L1/2, h=p.W/2;
    var p1=CSG.subtractAll(B(0,0,0,p.L1,p.W,p.T),[B(c-h,-1,-1,c+h,p.W+1,a),B(c-h,-1,b,c+h,p.W+1,p.T+1)]);
    var p2=B(c-h,0,0,c+h,p.L2,p.T).subtract(B(c-h-1,-1,a,c+h+1,p.W,b));
    return [
      {num:1,name:'Pieza rebajada',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con horquilla',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:p.W+60,phase:[0,1],draw:{rot:ROTZ}}];
  }
},
/* 3 */
{
  id:'mmmilano', num:3, name:'Media madera en cola de milano', en:'Dovetail halving joint', book:26,
  short:'Unión en T a media madera con cola',
  desc:'Es una media madera en T en la que el extremo de la pieza 2 tiene forma de cola de milano. Al ensanchar hacia la testa, la pieza no se puede sacar tirando.',
  steps:['Se rebaja a media madera el extremo de la pieza 2.','Se sierran los costados de la cola con la pendiente marcada.','Se copia la cola sobre la pieza 1 y se vacía el alojamiento hasta la mitad del grueso.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,0,1], label:'Corte por el centro de la cola'}, sectionC:function(p){ return -p.W/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:230,min:100,max:600},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500},
    {g:'Cola'},{k:'Wn',sym:'b',label:'Ancho de la cola en el hombro',v:33,min:10,max:110}]),
  validate:function(p){ if(p.Wn>=p.W) return 'La cola debe estrecharse: b menor que el ancho.'; if(p.W+40>=p.L1) return 'La pieza 1 es demasiado corta.'; return ''; },
  check:function(p){ var d=(p.W-p.Wn)/2, k=p.W/d; return [['Pendiente','1:'+num(k)+' ('+num(Math.atan(1/k)*180/Math.PI)+'°)',k>=5&&k<=9?'ok':'warn',k>=5&&k<=9?'habitual':'revisar'],['Cola',p.W+' mm en la testa · '+p.Wn+' mm en el hombro'],['Rebaje','mitad del grueso: '+num(p.T/2)+' mm']]; },
  build:function(p){
    var c=p.L1/2, h=p.W/2, d=(p.W-p.Wn)/2;
    function hw(z){ return h - d*z/p.W; }  // z=0 testa (ancho), z=W hombro (estrecho)
    var p1=B(0,0,0,p.L1,p.T,p.W).subtract(PR('y',[[c-hw(-1),-1],[c+hw(-1),-1],[c+hw(p.W+1),p.W+1],[c-hw(p.W+1),p.W+1]],p.T/2,p.T+1));
    var p2=CSG.subtractAll(B(c-h,0,0,c+h,p.T,p.L2),[
      B(c-h-1,-1,-1,c+h+1,p.T/2,p.W),
      PR('y',[[c-h-2,-1],[c-hw(-1),-1],[c-hw(p.W),p.W],[c-h-2,p.W]],-1,p.T+1),
      PR('y',[[c+hw(-1),-1],[c+h+2,-1],[c+h+2,p.W],[c+hw(p.W),p.W]],-1,p.T+1)]);
    return [
      {num:1,name:'Pieza con alojamiento',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con cola',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:p.T+50,phase:[0,1],draw:{rot:ROTY}}];
  },
  nota:'La cola se estrecha hacia el hombro. Marca la pendiente con falsa escuadra.'
},
/* 4 */
{
  id:'acunada', num:4, isoMin:60, name:'Caja y espiga pasante acuñada', en:'Wedged mortise & tenon', book:19,
  short:'Espiga pasante fijada con cuñas',
  desc:'La caja atraviesa la pieza 1 y se ensancha hacia la cara de salida. Las cuñas se meten a los lados de la espiga y la bloquean en forma de cola de milano.',
  steps:['Se marca y vacía la caja pasante desde las dos caras.','Se ensanchan con el formón los extremos de la caja en la cara de salida.','Se sierra la espiga dejando hombros en los cuatro lados.','Se monta la espiga y se meten las cuñas encoladas a los lados.','Se enrasan las cuñas y la espiga con la cara de la pieza 1.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:180,min:100,max:500},{k:'L2',sym:'L2',label:'Largo pieza 2',v:150,min:60,max:500},
    {g:'Espiga y cuñas'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:40},{k:'s',sym:'h',label:'Hombro lateral',v:5,min:2,max:20},
    {k:'f',sym:'f',label:'Ensanche de la caja por lado',v:3,min:1,max:8},{k:'q',sym:'q',label:'Sobrante de las cuñas',v:10,min:0,max:30}]),
  validate:function(p){ if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; if(p.W-2*p.s<10) return 'Los hombros dejan una espiga demasiado estrecha.'; return ''; },
  check:function(p){ var a=p.W-2*p.s, ok=Math.abs(p.e-p.T/3)<=1.5; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Caja',a+' mm en la entrada · '+(a+2*p.f)+' mm en la salida'],['Cuñas','2 uds. · de 0 a '+p.f+' mm de grueso · '+p.e+' mm de ancho']]; },
  build:function(p){
    var c=p.L1/2, h=p.W/2, a=p.W-2*p.s, ha=a/2, z0=(p.T-p.e)/2, z1=(p.T+p.e)/2;
    function hw(y){ return ha + p.f*y/p.W; }
    var p1=B(0,0,0,p.L1,p.W,p.T).subtract(PR('z',[[c-hw(-1),-1],[c+hw(-1),-1],[c+hw(p.W+1),p.W+1],[c-hw(p.W+1),p.W+1]],z0,z1));
    var p2=B(c-h,-p.L2,0,c+h,0,p.T).union(B(c-ha,-5,z0,c+ha,p.W,z1));
    function wedge(sg){ var x0=c+sg*ha, x1=c+sg*(ha+p.f);
      return PR('z',[[x0,0],[x1,p.W],[x1,p.W+p.q],[x0,p.W+p.q]],z0,z1); }
    return [
      {num:1,name:'Pieza con caja',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con espiga',wood:WOOD.light,solid:p2,dir:[0,-1,0],dist:p.W+50,phase:[0,0.5],draw:{rot:[['z',90]]}},
      {num:3,name:'Cuña',qty:2,wood:WOOD.dowel,solid:wedge(1),dir:[0,1,0],dist:45,phase:[0.55,1],draw:{rot:[['z',-90]],views:['A','L']}},
      {num:3,name:'Cuña',wood:WOOD.dowel,solid:wedge(-1),dir:[0,1,0],dist:45,phase:[0.55,1],drawSkip:true}];
  },
  nota:'Las cuñas se dejan con sobrante y se enrasan después de encolar.'
},
/* 5 */
{
  id:'doble', num:5, name:'Caja y espiga doble', en:'Twin mortise & tenon', book:21,
  short:'Travesaño ancho con dos espigas',
  desc:'Cuando el travesaño es ancho se hacen dos espigas en lugar de una. Así la madera de la pieza con cajas no se debilita y la unión trabaja mejor.',
  steps:['Se reparten en el ancho del travesaño los hombros, las dos espigas y el hueco central.','Se vacían las dos cajas ciegas en la pieza 1.','Se sierran las espigas y se vacía el hueco entre ellas.','El travesaño entra en horizontal hasta apoyar los hombros.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:200,min:100,max:600},{k:'L2',sym:'L2',label:'Largo travesaño',v:150,min:60,max:500},
    {k:'Wr',sym:'A2',label:'Ancho del travesaño',v:70,min:40,max:200},
    {g:'Espigas'},{k:'e',sym:'e',label:'Grueso',v:8,min:3,max:40},{k:'s',sym:'h',label:'Hombro exterior',v:6,min:2,max:30},
    {k:'g',sym:'c',label:'Hueco central',v:14,min:4,max:80},{k:'l',sym:'l',label:'Largo de las espigas',v:30,min:8,max:80},{k:'k',sym:'k',label:'Holgura fondo caja',v:2,min:0,max:5}]),
  validate:function(p){ var t=(p.Wr-2*p.s-p.g)/2; if(t<8) return 'Las espigas quedan demasiado estrechas.'; if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; if(p.l+p.k>=p.W-5) return 'Las cajas son más profundas que el ancho de la pieza 1.'; if(p.Wr+40>=p.L1) return 'La pieza 1 es demasiado corta.'; return ''; },
  check:function(p){ var t=(p.Wr-2*p.s-p.g)/2; return [['Cada espiga',num(t)+' × '+p.e+' × '+p.l+' mm'],['Cajas',num(t)+' × '+p.e+' × '+(p.l+p.k)+' mm de fondo'],['Reparto',p.s+' + '+num(t)+' + '+p.g+' + '+num(t)+' + '+p.s+' = '+p.Wr+' mm']]; },
  build:function(p){
    var c=p.L1/2, t=(p.Wr-2*p.s-p.g)/2, z0=(p.T-p.e)/2, z1=(p.T+p.e)/2, xs=[c-p.Wr/2+p.s, c+p.g/2];
    var p1=CSG.subtractAll(B(0,0,0,p.L1,p.W,p.T), xs.map(function(x){ return B(x,p.W-p.l-p.k,z0,x+t,p.W+1,z1); }));
    var p2=CSG.unionAll([B(c-p.Wr/2,p.W,0,c+p.Wr/2,p.W+p.L2,p.T)].concat(xs.map(function(x){ return B(x,p.W-p.l,z0,x+t,p.W+5,z1); })));
    return [
      {num:1,name:'Pieza con cajas',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Travesaño con espigas',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:p.l+60,phase:[0,1],draw:{rot:ROTZ}}];
  }
},
/* 6 */
{
  id:'milano', num:6, isoMin:46, name:'Cola de milano pasante', en:'Through dovetail', book:48,
  short:'Esquina de caja con colas vistas',
  desc:'Las colas de la pieza 2 encajan en los huecos que dejan los pernos de la pieza 1. Se ven por las dos caras de la esquina y resisten muy bien la tracción.',
  steps:['Se marca la línea base en las dos piezas con el grueso de la otra.','Se marcan y sierran las colas en la pieza 2.','Se copian las colas sobre la testa de la pieza 1.','Se sierran y vacían los pernos.','La pieza 2 baja en vertical sobre los pernos.'],
  section:{n:[0,-1,0], label:'Corte horizontal por las colas'}, sectionC:function(p){ return p.Hp-p.t/2; },
  params:[{g:'Tableros'},{k:'t',sym:'G',label:'Grueso (ambos)',v:20,min:8,max:50},{k:'W',sym:'A',label:'Ancho',v:100,min:40,max:400},
    {k:'Hp',sym:'L1',label:'Largo pieza 1 (pernos)',v:150,min:60,max:600},{k:'Lt',sym:'L2',label:'Largo pieza 2 (colas)',v:150,min:60,max:600},
    {g:'Colas'},{k:'n',sym:'n',label:'Número de colas',v:2,min:1,max:10,step:1,int:true},{k:'pp',sym:'p',label:'Perno en la cara',v:10,min:2,max:60},{k:'k',sym:'1:k',label:'Pendiente',v:8,min:3,max:12,step:1}],
  validate:function(p){ var wT=(p.W-(p.n+1)*p.pp)/p.n; if(wT<=0) return 'No caben las colas.'; if(wT-2*p.t/p.k<2) return 'Las colas quedan demasiado estrechas en la base.'; if(p.t*2>=p.Hp||p.t*2>=p.Lt) return 'Los tableros son demasiado cortos.'; return ''; },
  check:function(p){ var s=1/p.k, wT=(p.W-(p.n+1)*p.pp)/p.n, ok=p.k>=6&&p.k<=8;
    return [['Pendiente','1:'+p.k+' → '+num(Math.atan(s)*180/Math.PI)+'°',ok?'ok':'warn',ok?'1:6 blandas · 1:8 duras':'fuera de lo habitual'],['Cola',num(wT)+' mm en la testa · '+num(wT-2*s*p.t)+' mm en la base'],['Perno',p.pp+' mm en la cara · '+num(p.pp+2*s*p.t)+' mm en la base']]; },
  build:function(p){ return dovetail(p, 0, p.t); },
  nota:function(p){ return 'Pendiente de las colas 1:'+p.k+'. Línea base al grueso de la otra pieza.'; }
},
/* 7 */
{
  id:'milanoOculta', num:7, name:'Cola de milano a media madera', en:'Lapped dovetail', book:52,
  short:'Frente de cajón: colas ocultas por la cara',
  desc:'Los pernos no atraviesan la pieza 1: queda una solapa que tapa las colas por la cara exterior. Es la unión típica del frente de un cajón.',
  steps:['Se marca la solapa en la testa de la pieza 1.','Se sierran las colas de la pieza 2, más cortas que el grueso de la pieza 1.','Se copian las colas sobre la testa de la pieza 1.','Se vacían los alojamientos con formón sin pasar de la solapa.','La pieza 2 baja en vertical.'],
  section:{n:[0,-1,0], label:'Corte horizontal por las colas'}, sectionC:function(p){ return p.Hp-p.tT/2; },
  params:[{g:'Tableros'},{k:'tF',sym:'G1',label:'Grueso pieza 1 (frente)',v:22,min:12,max:50},{k:'tT',sym:'G2',label:'Grueso pieza 2 (costado)',v:15,min:8,max:40},
    {k:'lap',sym:'s',label:'Solapa',v:6,min:2,max:20},{k:'W',sym:'A',label:'Ancho',v:100,min:40,max:400},
    {k:'Hp',sym:'L1',label:'Largo pieza 1',v:150,min:60,max:600},{k:'Lt',sym:'L2',label:'Largo pieza 2',v:150,min:60,max:600},
    {g:'Colas'},{k:'n',sym:'n',label:'Número de colas',v:2,min:1,max:10,step:1,int:true},{k:'pp',sym:'p',label:'Perno en la testa',v:10,min:2,max:60},{k:'k',sym:'1:k',label:'Pendiente',v:8,min:3,max:12,step:1}],
  validate:function(p){ if(p.lap>=p.tF-4) return 'La solapa deja colas demasiado cortas.'; var wT=(p.W-(p.n+1)*p.pp)/p.n; if(wT<=0) return 'No caben las colas.'; if(wT-2*(p.tF-p.lap)/p.k<2) return 'Las colas quedan demasiado estrechas.'; return ''; },
  check:function(p){ var lt=p.tF-p.lap, s=1/p.k, wT=(p.W-(p.n+1)*p.pp)/p.n; return [['Largo de las colas','G1 − s = '+lt+' mm'],['Cola',num(wT)+' mm en la testa · '+num(wT-2*s*lt)+' mm en la base'],['Pendiente','1:'+p.k]]; },
  build:function(p){ return dovetail({t:p.tT,W:p.W,Hp:p.Hp,Lt:p.Lt,n:p.n,pp:p.pp,k:p.k}, p.lap, p.tF); },
  nota:function(p){ return 'Las colas no atraviesan: queda una solapa de '+num(p.lap)+' mm en la cara del frente. Pendiente 1:'+p.k+'.'; }
},
/* 8 */
{
  id:'encastrado', num:8, name:'Encastrado pasante', en:'Through housing joint', book:57,
  short:'Balda en ranura de lado a lado',
  desc:'La pieza 2 entra en una ranura (encastre) tallada a través de todo el ancho de la pieza 1. Es la forma clásica de colocar baldas fijas.',
  steps:['Se marca el ancho de la ranura con el grueso real de la pieza 2.','Se sierran los dos costados hasta la profundidad.','Se vacía el fondo con formón o guillame.','La pieza 2 entra en la ranura.'],
  section:{n:[0,0,-1], label:'Corte por el centro del ancho'}, sectionC:function(p){ return p.D/2; },
  params:[{g:'Pieza 1 (lateral)'},{k:'Ls',sym:'L1',label:'Largo',v:200,min:80,max:800},{k:'ts',sym:'G1',label:'Grueso',v:18,min:10,max:40},{k:'D',sym:'A',label:'Ancho (ambas)',v:100,min:40,max:400},
    {g:'Pieza 2 (balda)'},{k:'tb',sym:'G2',label:'Grueso',v:18,min:6,max:40},{k:'Lb',sym:'L2',label:'Largo',v:150,min:40,max:800},{g:'Ranura'},{k:'h',sym:'r',label:'Profundidad',v:6,min:2,max:20}],
  validate:function(p){ if(p.h>=p.ts/2) return 'La ranura no debe pasar de la mitad del grueso.'; if(p.tb+30>=p.Ls) return 'La pieza 1 es demasiado corta.'; return ''; },
  check:function(p){ var ok=p.h<=p.ts/3+0.5; return [['Profundidad de ranura','≤ G1/3 = '+num(p.ts/3)+' mm · tienes '+p.h+' mm',ok?'ok':'warn',ok?'correcto':'algo profunda'],['Ranura',p.tb+' × '+p.h+' mm, pasante']]; },
  build:function(p){ return housing(p,'through'); }
},
/* 9 */
{
  id:'encastradoCiego', num:9, name:'Encastrado ciego', en:'Stopped housing joint', book:59,
  short:'La ranura se detiene antes del canto',
  desc:'Igual que el encastrado pasante, pero la ranura no llega al canto delantero. Así la unión no se ve por delante. La balda lleva una muesca en la esquina.',
  steps:['Se marca la ranura y su parada a la distancia indicada del canto.','Se taladra o vacía con formón el final de la ranura para poder serrar.','Se sierran los costados y se vacía el fondo.','Se hace la muesca en la esquina delantera de la pieza 2.','La pieza 2 entra en la ranura.'],
  section:{n:[-1,0,0], label:'Corte por el centro de la balda'}, sectionC:function(p){ return p.Ls/2; },
  params:[{g:'Pieza 1 (lateral)'},{k:'Ls',sym:'L1',label:'Largo',v:200,min:80,max:800},{k:'ts',sym:'G1',label:'Grueso',v:18,min:10,max:40},{k:'D',sym:'A',label:'Ancho (ambas)',v:100,min:40,max:400},
    {g:'Pieza 2 (balda)'},{k:'tb',sym:'G2',label:'Grueso',v:18,min:6,max:40},{k:'Lb',sym:'L2',label:'Largo',v:150,min:40,max:800},
    {g:'Ranura'},{k:'h',sym:'r',label:'Profundidad',v:6,min:2,max:20},{k:'st',sym:'m',label:'Parada desde el canto',v:12,min:4,max:60}],
  validate:function(p){ if(p.h>=p.ts/2) return 'La ranura no debe pasar de la mitad del grueso.'; if(p.st>=p.D-20) return 'La parada es demasiado larga.'; return ''; },
  check:function(p){ return [['Ranura',p.tb+' × '+p.h+' mm · se para a '+p.st+' mm del canto'],['Muesca en la balda',p.st+' × '+p.h+' mm']]; },
  build:function(p){ return housing(p,'stopped'); }
},
/* 10 */
{
  id:'encastradoMilano', num:10, name:'Encastrado en cola de milano', en:'Dovetail housing joint', book:58,
  short:'Ranura con flancos en cola: la balda entra deslizando',
  desc:'La ranura tiene los flancos inclinados y la balda un extremo en forma de cola de milano. Solo se puede montar deslizando desde el canto, y la balda no se sale de la ranura.',
  steps:['Se marca la ranura: estrecha en la cara y ancha en el fondo.','Se sierran los flancos con la inclinación y se vacía el fondo.','Se rebaja el extremo de la balda dejando los hombros.','La balda entra deslizando por el canto.'],
  section:{n:[0,0,-1], label:'Corte por el centro del ancho'}, sectionC:function(p){ return p.D/2; },
  params:[{g:'Pieza 1 (lateral)'},{k:'Ls',sym:'L1',label:'Largo',v:200,min:80,max:800},{k:'ts',sym:'G1',label:'Grueso',v:18,min:10,max:40},{k:'D',sym:'A',label:'Ancho (ambas)',v:100,min:40,max:400},
    {g:'Pieza 2 (balda)'},{k:'tb',sym:'G2',label:'Grueso',v:18,min:8,max:40},{k:'Lb',sym:'L2',label:'Largo',v:150,min:40,max:800},
    {g:'Ranura'},{k:'h',sym:'r',label:'Profundidad',v:6,min:3,max:20},{k:'sh',sym:'h',label:'Hombro de la balda',v:2,min:1,max:8}],
  validate:function(p){ if(p.h>=p.ts/2) return 'La ranura no debe pasar de la mitad del grueso.'; if(p.tb-2*p.sh<4) return 'Los hombros dejan la cola demasiado estrecha.'; return ''; },
  check:function(p){ return [['Ranura',(p.tb-2*p.sh)+' mm en la cara · '+p.tb+' mm en el fondo · '+p.h+' mm de profundidad'],['Inclinación de los flancos',num(Math.atan(p.sh/p.h)*180/Math.PI)+'°']]; },
  build:function(p){ return housing(p,'dovetail'); }
},
/* 11 */
{
  id:'dedos', num:11, name:'Ensamble de dedos', en:'Finger joint', book:46,
  short:'Esquina de caja con dedos rectos',
  desc:'Los dedos rectos de una pieza encajan en los huecos de la otra. Tiene mucha superficie de encolado y es fácil de hacer a mano, con sierra de cinta o con fresadora.',
  steps:['Se reparte el ancho en un número impar de dedos iguales.','Se marca la línea base con el grueso de la otra pieza.','Se sierran los dedos y se vacían los huecos alternos.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,-1,0], label:'Corte horizontal por los dedos'}, sectionC:function(p){ return p.Hp-p.t/2; },
  params:[{g:'Tableros'},{k:'t',sym:'G',label:'Grueso (ambos)',v:18,min:6,max:50},{k:'W',sym:'A',label:'Ancho',v:100,min:40,max:400},
    {k:'Hp',sym:'L1',label:'Largo pieza 1',v:150,min:60,max:600},{k:'Lt',sym:'L2',label:'Largo pieza 2',v:150,min:60,max:600},
    {g:'Dedos'},{k:'N',sym:'N',label:'Número de dedos (impar)',v:5,min:3,max:31,step:2,int:true}],
  validate:function(p){ if(p.N%2===0) return 'El número de dedos debe ser impar.'; if(p.W/p.N<4) return 'Los dedos quedan demasiado estrechos.'; return ''; },
  check:function(p){ var f=p.W/p.N; return [['Ancho de dedo','A/N = '+num(f)+' mm'],['Profundidad','igual al grueso: '+p.t+' mm'],['Dedos','pieza 1: '+((p.N+1)/2)+' · pieza 2: '+((p.N-1)/2)]]; },
  build:function(p){
    var f=p.W/p.N, t=p.t, y0=p.Hp-t, cV=[], cH=[];
    for(var i=0;i<p.N;i++){ var zl=i*f, zh=(i+1)*f;
      if(i%2===1) cV.push(B(-1,y0,zl,t+1,p.Hp+1,zh)); else cH.push(B(-1,y0-1,i===0?-1:zl,t,p.Hp+1,i===p.N-1?p.W+1:zh)); }
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:CSG.subtractAll(B(0,0,0,t,p.Hp,p.W),cV),dir:[0,0,0],dist:0,phase:[0,1],draw:{rot:[['z',90]]}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:CSG.subtractAll(B(0,y0,0,p.Lt,p.Hp,p.W),cH),dir:[0,1,0],dist:t+60,phase:[0,1],draw:{}}];
  }
},
/* 12 */
{
  id:'lengueta', num:12, name:'Inglete con lengüeta', en:'Splined mitre joint', book:8,
  short:'Esquina a 45° reforzada con lengüeta',
  desc:'Las dos piezas se cortan a 45°. En la cara del inglete se hace una ranura y una lengüeta de contrachapado la atraviesa, de modo que refuerza la unión y la centra al encolar.',
  steps:['Se cortan los ingletes a 45° con la caja de ingletes o la ingletadora.','Se hace la ranura centrada en el grueso, perpendicular a la cara del inglete.','Se corta la lengüeta con la veta atravesada.','Se encola la lengüeta en una pieza y se cierra la esquina.'],
  section:{n:[0,0,-1], label:'Corte por la lengüeta'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L',label:'Largo de cada pieza',v:180,min:80,max:500},{g:'Lengüeta'},{k:'g',sym:'g',label:'Grueso',v:4,min:2,max:10},{k:'d',sym:'d',label:'Profundidad por pieza',v:10,min:4,max:25}]),
  validate:function(p){ if(p.g>=p.T-8) return 'La lengüeta es demasiado gruesa.'; return ''; },
  check:function(p){ return [['Ranura',p.g+' mm de ancho · '+p.d+' mm de profundidad, centrada'],['Lengüeta',p.g+' × '+(2*p.d-1)+' mm (1 mm menos para la cola)'],['Inglete','45° en las dos piezas · largo '+num(p.W*Math.SQRT2)+' mm']]; },
  build:function(p){
    var W=p.W, L=p.L1, s2=Math.SQRT1_2, z0=(p.T-p.g)/2, z1=(p.T+p.g)/2, d=p.d;
    function strip(w,ext){ // franja centrada en la diagonal (0,0)-(W,W), semiancho w
      var n=[s2,-s2], u=[s2,s2], A=[-ext*u[0],-ext*u[1]], Bp=[W+ext*u[0],W+ext*u[1]];
      return [[A[0]+w*n[0],A[1]+w*n[1]],[Bp[0]+w*n[0],Bp[1]+w*n[1]],[Bp[0]-w*n[0],Bp[1]-w*n[1]],[A[0]-w*n[0],A[1]-w*n[1]]]; }
    var groove=PR('z',strip(d,10),z0,z1);
    var p1=CSG.subtractAll(B(0,0,0,L,W,p.T),[PR('z',[[-1,-1],[W+1,W+1],[-1,W+1]],-1,p.T+1),groove]);
    var p2=CSG.subtractAll(B(0,0,0,W,L,p.T),[PR('z',[[-1,-1],[W+1,-1],[W+1,W+1]],-1,p.T+1),groove]);
    var sp=PR('z',strip(d-0.5,10),z0,z1).intersect(B(0,0,z0-1,W,W,z1+1));
    var dn=[-s2,s2,0];
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{dims:{X:[0,W,L]}}},
      {num:3,name:'Lengüeta (contrachapado)',wood:WOOD.ply,solid:sp,dir:dn,dist:40,phase:[0,0.45],draw:{rot:[['z',-45]],views:['A','L']}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:dn,dist:90,phase:[0.5,1],draw:{rot:ROTZ,dims:{X:[0,W,L]}}}];
  },
  nota:function(p){ return 'Ingletes a 45°. Ranura de '+num(p.g)+' × '+num(p.d)+' mm centrada. Lengüeta de contrachapado 1 mm más corta.'; }
},
/* 13 */
{
  id:'horquillaInglete', num:13, name:'Horquilla a inglete', en:'Mitred corner bridle joint', book:11,
  short:'Horquilla con la cara vista a 45°',
  desc:'Es una horquilla en esquina en la que la cara delantera se corta a inglete. Por delante se ve un inglete limpio y por detrás la resistencia de la horquilla.',
  steps:['Se marcan los tercios del grueso y la diagonal del inglete en la cara vista.','Se sierra la horquilla en la pieza 1 y la espiga en la pieza 2.','Se corta a 45° el costado delantero de las dos piezas.','La pieza 2 entra deslizando en vertical.'],
  section:{n:[0,0,-1], label:'Corte por la espiga'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L',label:'Largo de cada pieza',v:180,min:80,max:500},{g:'Horquilla'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:40}]),
  validate:function(p){ if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; return ''; },
  check:function(p){ var ok=Math.abs(p.e-p.T/3)<=1.5; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Inglete','solo en el costado delantero ('+num((p.T-p.e)/2)+' mm)']]; },
  build:function(p){
    var W=p.W, L=p.L1, a=(p.T-p.e)/2, b=(p.T+p.e)/2;
    var p1=CSG.subtractAll(B(0,0,0,L,W,p.T),[B(-1,-1,a,W,W+1,b),PR('z',[[-1,-1],[W+1,W+1],[-1,W+1]],b-0.001,p.T+1)]);
    var p2=CSG.subtractAll(B(0,0,0,W,L,p.T),[B(-1,-1,-1,W+1,W,a),PR('z',[[-1,-1],[W+1,-1],[W+1,W+1]],b,p.T+1)]);
    return [
      {num:1,name:'Pieza con horquilla',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con espiga',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:W+60,phase:[0,1],draw:{rot:ROTZ}}];
  },
  nota:'El inglete solo afecta al costado delantero; la espiga y el costado trasero son de horquilla normal.'
},
/* 14 */
{
  id:'tarugos', num:14, name:'Unión en T con tarugos', en:'Dowel joint', book:69,
  short:'Travesaño a tope con dos tarugos',
  desc:'La pieza 2 apoya a tope en el canto de la pieza 1 y la unión la hacen dos tarugos (espigas cilíndricas) encolados en taladros ciegos.',
  steps:['Se marcan los centros de los taladros en las dos piezas con la misma referencia.','Se taladra a la profundidad indicada con tope de broca.','Se encolan los tarugos en la pieza 1.','La pieza 2 entra en los tarugos.'],
  section:{n:[0,0,-1], label:'Corte por el eje de los tarugos'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:230,min:100,max:600},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:60,max:500},
    {g:'Tarugos'},{k:'d',sym:'Ø',label:'Diámetro',v:8,min:4,max:16,step:1},{k:'Ld',sym:'l',label:'Largo',v:40,min:16,max:80,step:1},{k:'sep',sym:'s',label:'Separación entre ejes',v:22,min:10,max:80}]),
  validate:function(p){ if(p.d>=p.T-6) return 'El tarugo es demasiado grueso para la pieza.'; if(p.sep+p.d+6>p.W) return 'Los tarugos no caben en el ancho.'; if(p.Ld/2+3>=p.W) return 'Los tarugos son demasiado largos.'; return ''; },
  check:function(p){ var ok=p.d>=p.T/3-1&&p.d<=p.T/2+0.5; return [['Diámetro','entre G/3 y G/2 = '+num(p.T/3)+'–'+num(p.T/2)+' mm · tienes '+p.d,ok?'ok':'warn',ok?'correcto':'revisar'],['Taladros','Ø'+p.d+' × '+(p.Ld/2+1)+' mm en cada pieza'],['Tarugos','2 uds. Ø'+p.d+' × '+p.Ld+' mm']]; },
  build:function(p){
    var c=p.L1/2, h=p.W/2, zc=p.T/2, r=p.d/2, rh=r+0.25, xs=[c-p.sep/2,c+p.sep/2], hd=p.Ld/2+1;
    var p1=CSG.subtractAll(B(0,0,0,p.L1,p.W,p.T), xs.map(function(x){ return CSG.cylinder('y',x,zc,rh,p.W-hd,p.W+1,24); }));
    var p2=CSG.subtractAll(B(c-h,p.W,0,c+h,p.W+p.L2,p.T), xs.map(function(x){ return CSG.cylinder('y',x,zc,rh,p.W-1,p.W+hd,24); }));
    function dw(x){ return CSG.cylinder('y',x,zc,r,p.W-p.Ld/2,p.W+p.Ld/2,24); }
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{},
        holes:xs.map(function(x){ return {c:[x,p.W-hd/2,zc],axis:[0,1,0],len:hd,r:rh}; })},
      {num:3,name:'Tarugo',qty:2,wood:WOOD.dowel,solid:dw(xs[0]),dir:[0,1,0],dist:p.Ld+30,phase:[0,0.45],draw:{rot:ROTZ,views:['A','L']},
        holes:[{c:[xs[0],p.W,zc],axis:[0,1,0],len:p.Ld,r:r}]},
      {num:3,name:'Tarugo',wood:WOOD.dowel,solid:dw(xs[1]),dir:[0,1,0],dist:p.Ld+30,phase:[0,0.45],drawSkip:true},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:p.Ld*2+60,phase:[0.5,1],draw:{rot:ROTZ},
        holes:xs.map(function(x){ return {c:[x,p.W+hd/2,zc],axis:[0,1,0],len:hd,r:rh}; })}];
  },
  nota:'Tarugos estriados de haya. Taladros 1 mm más profundos que medio tarugo.'
},
/* 15 */
{
  id:'oblicua', num:15, name:'Media madera oblicua', en:'Oblique halving joint', book:28,
  short:'Dos piezas que se cruzan en ángulo',
  desc:'Es una media madera en cruz en la que las piezas no se cortan a 90°. Los costados del rebaje siguen el ángulo del cruce, por eso hay que marcarlos con falsa escuadra.',
  steps:['Se marca el ángulo con la falsa escuadra en las dos piezas.','Se sierran los costados del rebaje siguiendo el ángulo.','Se vacía hasta la mitad del grueso con formón o guillame.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,0,-1], label:'Corte por el eje de la pieza 1'}, sectionC:function(p){ return 0; },
  params:frameParams([{k:'L1',sym:'L',label:'Largo de cada pieza',v:230,min:120,max:600},{g:'Cruce'},{k:'ang',sym:'α',label:'Ángulo (grados)',v:60,min:30,max:89,step:1}]),
  validate:function(p){ if(p.W/Math.sin(p.ang*Math.PI/180)*1.2>=p.L1/2) return 'Las piezas son demasiado cortas para ese ángulo.'; return ''; },
  check:function(p){ var a=p.ang*Math.PI/180; return [['Ángulo','α = '+p.ang+'° (marcar con falsa escuadra)'],['Largo del rebaje','A / sen α = '+num(p.W/Math.sin(a))+' mm'],['Profundidad','mitad del grueso: '+num(p.T/2)+' mm']]; },
  build:function(p){
    var a=p.ang*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a), h=p.W/2, L=p.L1/2, T=p.T;
    function pt(t,k){ return [t*ca - k*sa, t*sa + k*ca]; }      // t a lo largo de la pieza 2, k perpendicular
    var p1=B(-L,0,-h,L,T,h), K=h+1;
    // punto de la recta k (paralela a la pieza 2) con coordenada z dada
    function onLine(z,k){ var t=(z - k*ca)/sa; return pt(t,k); }
    var prof1=[onLine(-K,-h),onLine(-K,h),onLine(K,h),onLine(K,-h)];
    p1=p1.subtract(PR('y',prof1,T/2,T+1));
    // Pieza 2: rectángulo girado
    var r2=[pt(-L,-h),pt(L,-h),pt(L,h),pt(-L,h)];
    var p2=PR('y',r2,0,T);
    var prof2=[onLine(-h,-K),onLine(-h,K),onLine(h,K),onLine(h,-K)];
    p2=p2.subtract(PR('y',prof2,-1,T/2));
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:T+50,phase:[0,1],draw:{rot:[['y',p.ang]]}}];
  },
  nota:function(p){ return 'Ángulo de cruce entre las piezas: '+p.ang+'°. Rebajes a la mitad del grueso.'; }
},
/* 16 */
{
  id:'mmRecta', num:16, name:'Media madera recta en esquina', en:'Corner halving joint', book:7,
  short:'Esquina de bastidor a media madera',
  desc:'Las dos piezas se rebajan hasta la mitad de su grueso en el extremo y se solapan formando una esquina. Es la media madera más sencilla.',
  steps:['Se marca en cada pieza el ancho de la otra y la mitad del grueso con el gramil.','Se sierra a la mitad del grueso por la línea del hombro.','Se sierra la testa a lo largo y se limpia con formón o guillame.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,0,1], label:'Corte por el centro del ancho'}, sectionC:function(p){ return -p.W/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:180,min:80,max:500},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500},
    {g:'Rebaje'},{k:'R',sym:'r',label:'Profundidad en la pieza 1',v:12,min:2,max:58}]),
  validate:function(p){ if(p.R>=p.T) return 'La profundidad del rebaje debe ser menor que el grueso.'; if(p.W*2>=p.L1||p.W*2>=p.L2) return 'Las piezas son demasiado cortas.'; return ''; },
  check:function(p){ var ok=Math.abs(p.R-p.T/2)<0.6; return [['Rebaje recomendado','G/2 = '+num(p.T/2)+' mm · tienes '+p.R+' mm',ok?'ok':'warn',ok?'correcto':'quedará desnivelado'],['Pieza 1',p.W+' × '+p.R+' mm (cara superior)'],['Pieza 2',p.W+' × '+num(p.T-p.R)+' mm (cara inferior)']]; },
  build:function(p){
    var W=p.W, T=p.T, y=T-p.R;
    var p1=B(0,0,0,p.L1,T,W).subtract(B(-1,y,-1,W,T+1,W+1));
    var p2=B(0,0,0,W,T,p.L2).subtract(B(-1,-1,-1,W+1,y,W));
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:T+50,phase:[0,1],draw:{rot:ROTY}}];
  }
},
/* 17 */
{
  id:'mmInglete', num:17, name:'Media madera con inglete', en:'Mitred halving joint', book:7,
  short:'Esquina a media madera con la cara vista a 45°',
  desc:'Por detrás es una media madera, pero por la cara vista se ve un inglete a 45°. Une la resistencia de la media madera con el aspecto limpio del inglete.',
  steps:['Se rebajan las dos piezas a media madera como en la esquina recta.','En la cara vista se marca la diagonal a 45° con la escuadra de inglete.','En la pieza 1 se corta la mitad superior a 45°; en la pieza 2 se elimina la mitad inferior y se corta la superior a 45°.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,0,1], label:'Corte por el centro del ancho'}, sectionC:function(p){ return -p.W/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:180,min:80,max:500},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500}]),
  validate:function(p){ if(p.W*2>=p.L1||p.W*2>=p.L2) return 'Las piezas son demasiado cortas.'; return ''; },
  check:function(p){ return [['Rebaje','mitad del grueso: '+num(p.T/2)+' mm'],['Inglete','45° en la cara vista · largo '+num(p.W*Math.SQRT2)+' mm']]; },
  build:function(p){
    var W=p.W, T=p.T, h=T/2;
    var p1=B(0,0,0,p.L1,T,W).subtract(PR('y',[[-1,-1],[W+1,W+1],[-1,W+1]],h,T+1));
    var p2=CSG.subtractAll(B(0,0,0,W,T,p.L2),[B(-1,-1,-1,W+1,h,W),PR('y',[[-1,-1],[W+1,-1],[W+1,W+1]],h-1,T+1)]);
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:T+50,phase:[0,1],draw:{rot:ROTY}}];
  },
  nota:'Inglete a 45° solo en la mitad superior (cara vista). La mitad inferior es una media madera normal.'
},
/* 18 */
{
  id:'mmT', num:18, name:'Media madera en T', en:'T-halving joint', book:25,
  short:'Travesaño a media madera en el centro de otra pieza',
  desc:'El extremo de la pieza 2 se rebaja a media madera y encaja en un rebaje del mismo ancho hecho en el centro de la pieza 1.',
  steps:['Se marca en la pieza 1 el ancho real de la pieza 2.','Se sierran los costados del rebaje hasta la mitad del grueso y se vacía con formón.','Se rebaja a media madera el extremo de la pieza 2.','La pieza 2 baja en vertical sobre la pieza 1.'],
  section:{n:[0,0,1], label:'Corte por el centro del rebaje'}, sectionC:function(p){ return -p.W/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:230,min:100,max:600},{k:'L2',sym:'L2',label:'Largo pieza 2',v:180,min:80,max:500}]),
  validate:function(p){ if(p.W+40>=p.L1) return 'La pieza 1 es demasiado corta.'; return ''; },
  check:function(p){ return [['Rebaje en la pieza 1',p.W+' × '+num(p.T/2)+' mm en el centro'],['Rebaje en la pieza 2',p.W+' × '+num(p.T/2)+' mm en el extremo']]; },
  build:function(p){
    var c=p.L1/2, h=p.W/2, T=p.T;
    var p1=B(0,0,0,p.L1,T,p.W).subtract(B(c-h,T/2,-1,c+h,T+1,p.W+1));
    var p2=B(c-h,0,0,c+h,T,p.L2).subtract(B(c-h-1,-1,-1,c+h+1,T/2,p.W));
    return [
      {num:1,name:'Pieza 1',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza 2',wood:WOOD.light,solid:p2,dir:[0,1,0],dist:T+50,phase:[0,1],draw:{rot:ROTY}}];
  }
},
/* 19 */
{
  id:'pasante', num:19, name:'Caja y espiga pasante', en:'Through mortise & tenon', book:20,
  short:'La espiga atraviesa la pieza con caja',
  desc:'La caja atraviesa todo el ancho de la pieza 1 y la espiga se ve por el otro canto. Se suele dejar un poco larga y se enrasa después de encolar.',
  steps:['Se marcan la caja y la espiga con el gramil de mortajar en las dos piezas.','Se vacía la caja desde los dos cantos hasta encontrarse en el centro.','Se sierran los costados y los hombros de la espiga.','La espiga entra hasta asomar por el otro canto y se enrasa.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo pieza 1',v:180,min:100,max:500},{k:'L2',sym:'L2',label:'Largo pieza 2',v:150,min:60,max:500},
    {g:'Espiga'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:40},{k:'s',sym:'h',label:'Hombro lateral',v:5,min:0,max:20},{k:'q',sym:'q',label:'Sobrante para enrasar',v:2,min:0,max:10}]),
  validate:function(p){ if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; if(p.W-2*p.s<10) return 'Los hombros dejan una espiga demasiado estrecha.'; return ''; },
  check:function(p){ var ok=Math.abs(p.e-p.T/3)<=1.5; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Caja pasante',p.e+' × '+(p.W-2*p.s)+' mm'],['Largo de la espiga',p.W+' + '+p.q+' = '+(p.W+p.q)+' mm']]; },
  build:function(p){
    var c=p.L1/2, h=p.W/2, a=(p.W-2*p.s)/2, z0=(p.T-p.e)/2, z1=(p.T+p.e)/2;
    var p1=B(0,0,0,p.L1,p.W,p.T).subtract(B(c-a,-1,z0,c+a,p.W+1,z1));
    var p2=B(c-h,-p.L2,0,c+h,0,p.T).union(B(c-a,-5,z0,c+a,p.W+p.q,z1));
    return [
      {num:1,name:'Pieza con caja',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
      {num:2,name:'Pieza con espiga',wood:WOOD.light,solid:p2,dir:[0,-1,0],dist:p.W+50,phase:[0,1],draw:{rot:[['z',90]]}}];
  },
  nota:function(p){ return p.q>0?'La espiga sobresale '+num(p.q)+' mm y se enrasa con el canto después de encolar.':'La espiga queda enrasada con el canto.'; }
},
/* 20 */
{
  id:'retalon', num:20, name:'Caja y espiga con retalón', en:'Haunched mortise & tenon', book:13,
  short:'Esquina de bastidor con espiga y espaldón',
  desc:'En la esquina de un bastidor, la espiga se estrecha cerca del borde para que la caja no quede abierta por la testa del larguero. El retalón (espaldón) es un trozo corto de espiga que rellena ese hueco y evita que el travesaño gire.',
  steps:['Se marcan la espiga, el hombro inferior y el retalón en el travesaño.','Se vacía la caja en el larguero y, junto a la testa, el alojamiento corto del retalón.','Se sierran los costados de la espiga y se corta el retalón a su largo.','El travesaño entra en horizontal hasta apoyar los hombros.'],
  section:{n:[0,0,-1], label:'Corte por el centro del grueso'}, sectionC:function(p){ return p.T/2; },
  params:frameParams([{k:'L1',sym:'L1',label:'Largo del larguero (pieza 1)',v:200,min:100,max:600},{k:'L2',sym:'L2',label:'Largo del travesaño (pieza 2)',v:150,min:60,max:500},
    {k:'Wr',sym:'A2',label:'Ancho del travesaño',v:60,min:30,max:200},
    {g:'Espiga y retalón'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:40},{k:'l',sym:'l',label:'Largo de la espiga',v:30,min:10,max:80},
    {k:'s',sym:'h',label:'Hombro inferior',v:5,min:0,max:30},{k:'hz',sym:'r',label:'Alto del retalón',v:15,min:5,max:60},{k:'hl',sym:'rl',label:'Largo del retalón',v:10,min:3,max:40},{k:'g',sym:'k',label:'Holgura fondo caja',v:2,min:0,max:5}]),
  validate:function(p){ if(p.e>=p.T-4) return 'La espiga (e) debe ser más fina que el grueso.'; if(p.l+p.g>=p.W-5) return 'La caja es más profunda que el ancho del larguero.'; if(p.hl>=p.l) return 'El retalón debe ser más corto que la espiga.'; if(p.Wr-p.s-p.hz<10) return 'La espiga queda demasiado estrecha: reduce el retalón o el hombro.'; return ''; },
  check:function(p){ var ok=Math.abs(p.e-p.T/3)<=1.5, w=p.Wr-p.s-p.hz; return [['Regla del tercio','e ≈ G/3 = '+num(p.T/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Espiga',w+' × '+p.e+' × '+p.l+' mm'],['Retalón',p.hz+' × '+p.e+' × '+p.hl+' mm'],['Caja',w+' × '+p.e+' × '+(p.l+p.g)+' mm + alojamiento del retalón']]; },
  build:function(p){
    var W=p.W, T=p.T, H=p.L1, z0=(T-p.e)/2, z1=(T+p.e)/2, yb=H-p.Wr, y0=yb+p.s, y1=H-p.hz;
    var p1=CSG.subtractAll(B(0,0,0,W,H,T),[B(W-p.l-p.g,y0,z0,W+1,y1,z1),B(W-p.hl-p.g,y1-1,z0,W+1,H+1,z1)]);
    var p2=CSG.subtractAll(B(W-p.l,yb,0,W+p.L2,H,T),[
      B(W-p.l-1,yb-1,-1,W,y0,T+1),B(W-p.l-1,yb-1,-1,W,H+1,z0),B(W-p.l-1,yb-1,z1,W,H+1,T+1),B(W-p.l-1,y1,-1,W-p.hl,H+1,T+1)]);
    return [
      {num:1,name:'Larguero con caja',wood:WOOD.dark,solid:p1,dir:[0,0,0],dist:0,phase:[0,1],draw:{rot:[['z',-90]]}},
      {num:2,name:'Travesaño con espiga y retalón',wood:WOOD.light,solid:p2,dir:[1,0,0],dist:p.l+60,phase:[0,1],draw:{}}];
  },
  nota:'El retalón rellena el hueco junto a la testa del larguero: la caja no queda abierta por arriba.'
},
/* 21 */
{
  id:'pataMesa', num:21, isoMin:50, name:'Caja y espiga a tres maderas', en:'Corner mortise & tenon', book:1,
  short:'Pata de mesa con dos travesaños',
  desc:'Unión típica de patas de mesa y silla: dos travesaños llegan a la misma pata. Cada espiga lleva retalón arriba y la punta cortada a 45° para que las dos espigas no choquen dentro de la pata.',
  steps:['Se marcan las dos cajas en las caras interiores de la pata, desplazadas hacia fuera.','Se vacían las cajas y los alojamientos de los retalones; se comunican dentro de la pata.','Se sierran las espigas con su retalón en los dos travesaños.','Se corta a 45° la punta de cada espiga y se prueba que no se toquen.','Se monta primero un travesaño y después el otro.'],
  section:{n:[0,-1,0], label:'Corte horizontal por las espigas'}, sectionC:function(p){ return p.H-p.Wr/2; },
  iso:[1,1,1],
  params:[{g:'Pata'},{k:'P',sym:'P',label:'Sección (cuadrada)',v:45,min:30,max:120},{k:'H',sym:'H',label:'Alto de la pata',v:200,min:120,max:900},
    {g:'Travesaños'},{k:'Wr',sym:'A',label:'Ancho',v:80,min:30,max:200},{k:'Tr',sym:'G',label:'Grueso',v:22,min:12,max:40},{k:'Lr',sym:'L',label:'Largo visible',v:120,min:60,max:600},{k:'re',sym:'d',label:'Retranqueo respecto a la cara',v:3,min:0,max:15},
    {g:'Espigas y retalón'},{k:'e',sym:'e',label:'Grueso de la espiga',v:8,min:3,max:20},{k:'l',sym:'l',label:'Largo de la espiga',v:30,min:10,max:80},
    {k:'s',sym:'h',label:'Hombro inferior',v:10,min:0,max:40},{k:'hz',sym:'r',label:'Alto del retalón',v:15,min:5,max:60},{k:'hl',sym:'rl',label:'Largo del retalón',v:10,min:3,max:40},{k:'g',sym:'k',label:'Holgura fondo caja',v:2,min:0,max:5}],
  validate:function(p){ if(p.e>=p.Tr-4) return 'La espiga (e) debe ser más fina que el travesaño.'; if(p.re+p.Tr>=p.P-5) return 'El travesaño no cabe en la cara de la pata.'; if(p.l+p.g>=p.P) return 'La espiga es más larga que la pata.'; if(p.hl>=p.l) return 'El retalón debe ser más corto que la espiga.'; if(p.Wr-p.s-p.hz<10) return 'La espiga queda demasiado estrecha.'; if(p.Wr+20>=p.H) return 'La pata es demasiado corta.'; return ''; },
  check:function(p){ var w=p.Wr-p.s-p.hz, z0=p.re+(p.Tr-p.e)/2, ok=Math.abs(p.e-p.Tr/3)<=1.5;
    return [['Regla del tercio','e ≈ G/3 = '+num(p.Tr/3)+' mm · tienes '+p.e+' mm',ok?'ok':'warn',ok?'correcto':'revisar'],['Espigas',w+' × '+p.e+' × '+p.l+' mm, punta a 45°'],['Retalón',p.hz+' × '+p.e+' × '+p.hl+' mm'],['Cajas','a '+num(z0)+' mm de la cara exterior de la pata']]; },
  build:function(p){
    var P=p.P, H=p.H, e=p.e, a=p.re+(p.Tr-e)/2, b=a+e, yb=H-p.Wr, y0=yb+p.s, y1=H-p.hz, l=p.l, gap=1;
    var leg=CSG.subtractAll(B(0,0,0,P,H,P),[
      B(P-l-p.g,y0,a,P+1,y1,b), B(P-p.hl-p.g,y1-1,a,P+1,H+1,b),
      B(a,y0,P-l-p.g,b,y1,P+1), B(a,y1-1,P-p.hl-p.g,b,H+1,P+1)]);
    // travesaño A (a lo largo de x), travesaño B (a lo largo de z)
    var rA=CSG.subtractAll(B(P-l,yb,p.re,P+p.Lr,H,p.re+p.Tr),[
      B(P-l-1,yb-1,-1,P,y0,P+1), B(P-l-1,yb-1,-1,P,H+1,a), B(P-l-1,yb-1,b,P,H+1,P+1), B(P-l-1,y1,-1,P-p.hl,H+1,P+1),
      PR('y',[[-60,-1],[gap,-1],[P+gap+2,P+2],[-60,P+2]],yb-1,H+1)]);
    var rB=CSG.subtractAll(B(p.re,yb,P-l,p.re+p.Tr,H,P+p.Lr),[
      B(-1,yb-1,P-l-1,P+1,y0,P), B(-1,yb-1,P-l-1,a,H+1,P), B(b,yb-1,P-l-1,P+1,H+1,P), B(-1,y1,P-l-1,P+1,H+1,P-p.hl),
      PR('y',[[-1,-60],[P+2,-60],[P+2,P+gap+2],[-1,gap]],yb-1,H+1)]);
    var rX=[0,l-p.hl,l,l+p.Lr], rZ=[0,a-p.re,b-p.re,p.Tr];
    return [
      {num:1,name:'Pata',wood:WOOD.dark,solid:leg,dir:[0,0,0],dist:0,phase:[0,1],draw:{rot:[['z',-90]],dims:{Y:[0,P-l-p.g,P-b,P-a,P],Z:[0,a,b,P-l-p.g,P]}}},
      {num:2,name:'Travesaño A',wood:WOOD.light,solid:rA,dir:[1,0,0],dist:l+60,phase:[0,0.5],draw:{views:['A','P'],dims:{X:rX,Z:rZ}}},
      {num:3,name:'Travesaño B',wood:WOOD.mid,solid:rB,dir:[0,0,1],dist:l+60,phase:[0.5,1],draw:{rot:ROTY,views:['A','P'],dims:{X:rX,Z:rZ}}}];
  },
  nota:'Puntas de las espigas a 45°, separadas 1 mm dentro de la pata. Cajas desplazadas hacia fuera.'
}

];

/* Cola de milano (pasante si lap = 0, a media madera si lap > 0). tF = grueso de la pieza de pernos */
function dovetail(p, lap, tF){
  var s=1/p.k, t=p.t, wT=(p.W-(p.n+1)*p.pp)/p.n, y0=p.Hp-t, i;
  function hw(x){ return wT/2 - s*(x-lap); }
  var zc=[]; for(i=0;i<p.n;i++) zc.push(p.pp + wT/2 + i*(p.pp+wT));
  var x0=lap>0?lap:-1, x1=tF+1;
  var tails=zc.map(function(c){ return PR('y',[[x0,c-hw(x0)],[x1,c-hw(x1)],[x1,c+hw(x1)],[x0,c+hw(x0)]], y0, p.Hp+1); });
  var pins=CSG.subtractAll(B(0,0,0,tF,p.Hp,p.W), tails);
  var xa=lap-1, xb=tF, cut=[];
  cut.push(PR('y',[[xa,-1],[xb,-1],[xb,zc[0]-hw(xb)],[xa,zc[0]-hw(xa)]], y0-1, p.Hp+1));
  for(i=0;i<p.n-1;i++) cut.push(PR('y',[[xa,zc[i]+hw(xa)],[xb,zc[i]+hw(xb)],[xb,zc[i+1]-hw(xb)],[xa,zc[i+1]-hw(xa)]], y0-1, p.Hp+1));
  var zl=zc[p.n-1];
  cut.push(PR('y',[[xa,zl+hw(xa)],[xb,zl+hw(xb)],[xb,p.W+1],[xa,p.W+1]], y0-1, p.Hp+1));
  var tailB=CSG.subtractAll(B(lap,y0,0, lap+p.Lt,p.Hp,p.W), cut);
  var zp=[0]; zc.forEach(function(c){ zp.push(c-wT/2, c+wT/2); }); zp.push(p.W);
  return [
    {num:1,name:'Pieza 1 (pernos)',wood:WOOD.dark,solid:pins,dir:[0,0,0],dist:0,phase:[0,1],draw:{rot:[['z',90]],dims:{Z:zp}}},
    {num:2,name:'Pieza 2 (colas)',wood:WOOD.light,solid:tailB,dir:[0,1,0],dist:t+60,phase:[0,1],draw:{dims:{Z:zp}}}];
}

/* Encastrados: lateral tumbado (x largo, y grueso, z ancho), balda de pie */
function housing(p, kind){
  var c=p.Ls/2, hb=p.tb/2, y0=p.ts-p.h, side=B(0,0,0,p.Ls,p.ts,p.D), shelf, dir=[0,1,0], dist=60;
  if(kind==='through'){
    side=side.subtract(B(c-hb,y0,-1,c+hb,p.ts+1,p.D+1));
    shelf=B(c-hb,y0,0,c+hb,y0+p.Lb,p.D);
  } else if(kind==='stopped'){
    side=side.subtract(B(c-hb,y0,-1,c+hb,p.ts+1,p.D-p.st));
    shelf=B(c-hb,y0,0,c+hb,y0+p.Lb,p.D).subtract(B(c-hb-1,y0-1,p.D-p.st,c+hb+1,p.ts,p.D+1));
  } else {
    var hn=hb-p.sh;  // semiancho en la cara
    function hw(y){ return hb - (hb-hn)*(y-y0)/p.h; }
    side=side.subtract(PR('z',[[c-hb,y0],[c+hb,y0],[c+hw(p.ts+1),p.ts+1],[c-hw(p.ts+1),p.ts+1]],-1,p.D+1));
    shelf=B(c-hb,p.ts,0,c+hb,y0+p.Lb,p.D).union(PR('z',[[c-hb,y0],[c+hb,y0],[c+hw(p.ts+3),p.ts+3],[c-hw(p.ts+3),p.ts+3]],0,p.D));
    dir=[0,0,-1]; dist=p.D+40;
  }
  return [
    {num:1,name:'Pieza 1 (lateral)',wood:WOOD.dark,solid:side,dir:[0,0,0],dist:0,phase:[0,1],draw:{}},
    {num:2,name:'Pieza 2 (balda)',wood:WOOD.light,solid:shelf,dir:dir,dist:dist,phase:[0,1],draw:{rot:ROTZ}}];
}

/* Proceso de trabajo: qué se ve en el 3D en cada paso del «Orden de trabajo».
   m: marcar · s: serrar · v: vaciar / quitar · c: cortar (serrar y quitar) · h: resaltar · a: montar hasta (0..1) · n: nada nuevo */
var PROC = {
  horquilla: ['m:1,2', 'c:1', 'c:2', 'a:1'],
  horquillaT: ['m:1,2', 'c:1', 'c:2', 'a:1'],
  mmmilano: ['m:2 s:2', 'v:2', 'm:1 c:1', 'a:1'],
  acunada: ['m:1 c:1', 'h:1', 'm:2 c:2', 'a:1', 'h:1,3'],
  doble: ['m:1,2', 'c:1', 'c:2', 'a:1'],
  milano: ['m:1,2', 'c:2', 'm:1', 'c:1', 'a:1'],
  milanoOculta: ['m:1', 'c:2', 'm:1', 'c:1', 'a:1'],
  encastrado: ['m:1', 's:1', 'v:1', 'a:1'],
  encastradoCiego: ['m:1', 's:1', 'v:1', 'c:2', 'a:1'],
  encastradoMilano: ['m:1', 'c:1', 'c:2', 'a:1'],
  dedos: ['m:1,2', 'm:1,2', 'c:1 c:2', 'a:1'],
  lengueta: ['c:1 c:2', 'h:1,2', 'h:3', 'a:1'],
  horquillaInglete: ['m:1,2', 'c:1 c:2', 'h:1,2', 'a:1'],
  tarugos: ['m:1,2', 'c:1 c:2', 'a:0.5', 'a:1'],
  oblicua: ['m:1,2', 's:1,2', 'v:1,2', 'a:1'],
  mmRecta: ['m:1,2', 's:1,2', 'v:1,2', 'a:1'],
  mmInglete: ['s:1,2', 'm:1,2', 'v:1,2', 'a:1'],
  mmT: ['m:1', 'c:1', 'c:2', 'a:1'],
  pasante: ['m:1,2', 'c:1', 'c:2', 'a:1'],
  retalon: ['m:2', 'c:1', 'c:2', 'a:1'],
  pataMesa: ['m:1', 'c:1', 's:2,3', 'v:2,3', 'a:1']
};
