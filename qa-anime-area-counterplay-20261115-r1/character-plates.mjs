// Curves in face coordinates (256 by 192) are wrapped onto the actual cheek mesh.
// The same canvas is sampled by the portrait studio and the live skinned material.
const headProfiles=[[.84,1.012,.965,.005],null,[.74,.97,1.025,.011],[1.07,1.015,.995,.010],[.74,1.065,.955,.007]];
export function skullBand(hero,y,rx,rz,forward){
  const jaw=Math.max(0,Math.min(1,(.134-y)/.214));
  const cheek=Math.exp(-((y-.147)*(y-.147))/.011);
  const [chin,wide,profile,front]=headProfiles[hero];
  return [y,rx*(1+(chin-1)*jaw+(wide-1)*cheek),rz*profile,forward+front*jaw];
}
export function paintCharacterSheet(canvas) {
  canvas.width=768;canvas.height=768;
  const pen=canvas.getContext("2d");
  pen.fillStyle="#ffffff";pen.fillRect(0,0,768,768);
  function path(d,fill,stroke,width=1){
    const p=new Path2D(d);
    if(fill){pen.fillStyle=fill;pen.fill(p);}
    if(stroke){pen.lineWidth=width;pen.strokeStyle=stroke;pen.stroke(p);}
  }
  function oval(x,y,rx,ry,c){pen.beginPath();pen.ellipse(x,y,rx,ry,0,0,2*Math.PI);pen.fillStyle=c;pen.fill();}
  const skins=[["#af705b","#f0b685","#ffdab0"],null,["#bb8277","#ead0b9","#ffe6cf"],["#a46148","#e3a077","#ffd1a2"],["#ac7055","#edac7d","#ffdbac"]];
  for(const hero of [0,2,3,4]){
    const cellX=hero%3*256,cellY=Math.floor(hero/3)*192,tones=skins[hero],luffy=hero===4,goku=hero===3;
    pen.save();pen.translate(cellX,cellY);pen.beginPath();pen.rect(0,0,256,192);pen.clip();pen.lineJoin="round";pen.lineCap="round";
    const face=pen.createRadialGradient(117,92,16,126,101,145);
    face.addColorStop(0,tones[2]);face.addColorStop(.62,tones[1]);face.addColorStop(1,tones[0]);pen.fillStyle=face;pen.fillRect(0,0,256,192);
    path("M4 88 Q22 119 45 128 Q51 159 85 181 L43 178 Q12 161 4 146Z","#ab69523e");
    path("M210 114 Q232 104 252 74 L255 154 Q236 177 187 187 Q214 164 210 114Z","#a15b463d");
    path("M61 149 Q89 169 111 175 Q136 184 164 169 Q151 187 126 190 Q91 183 61 149Z","#9c655632");
    path("M113 108 Q120 103 124 83 Q126 107 133 123 L124 132 L114 126Z","#c485655e");
    path("M123 129 Q128 131 135 126",null,"#a56950",1.9);
    for(const side of [-1,1]){
      pen.save();pen.translate(128,0);pen.scale(side,1);
      if(hero!==2){
        const outline=luffy?"M12 86 C17 66 37 62 49 80 C57 95 44 108 29 108 C19 108 13 99 12 86Z":
          goku?"M12 85 L52 69 Q59 72 51 88 Q42 103 21 101Z":"M11 84 Q29 68 53 76 Q49 93 35 99 Q20 104 11 91Z";
        path(outline,"#fff5da","#463735",luffy?2.5:3);
        const ix=goku?29:luffy?31:32,iy=luffy?87:86;
        if(hero===0){oval(ix,iy,9.1,10.5,"#3e6d80");oval(ix,iy-.4,6.1,8.3,"#528fa1");}
        oval(ix,iy,hero===0?3.8:luffy?4.1:5.1,luffy?5.8:7,"#222c31");
        oval(ix-1.7,iy-3.2,1.7,1.8,"#fffaf0");
        path(goku?"M10 79 Q23 73 50 59 L59 60 L52 67 L13 85Z":luffy?
          "M16 65 Q34 55 50 62 L49 65 Q34 61 17 69Z":"M12 72 Q34 58 57 65 L54 69 Q37 66 15 77Z",
          hero===0?"#9a653c":"#352c2e");
        if(!luffy)path("M23 105 Q39 104 48 95",null,"#ad715088",1.4);
      }
      if(hero===0)for(let i=0;i<3;i++)path("M"+(48+i*3)+" "+(109+i*9)+" Q69 "+(109+i*11)+" 83 "+(99+i*13),null,"#784f41",2.1);
      pen.restore();
    }
    if(luffy){
      path("M102 145 Q127 153 152 138 Q142 162 119 158 Q107 156 102 145Z","#713c37","#815443",1);
      path("M105 146 Q126 152 148 141 Q138 151 120 152Z","#fff0ce");
      path("M159 107 Q171 113 184 110 M165 105 l-2 7 M173 108 l-2 7",null,"#954e43",1.65);
    }else{
      path(goku?"M106 149 Q126 146 147 143":"M108 146 Q126 151 145 143",null,"#865044",2.3);
      path("M119 155 Q129 157 137 151",null,"#ffe1ae",1.9);
    }
    if(hero===2){
      path("M-5 48 Q127 69 261 46 L260 92 Q136 112 -5 94Z","#343841");
      for(let i=0;i<3;i++)path("M-1 "+(61+i*11)+" Q127 "+(76+i*11)+" 258 "+(56+i*11),null,"#525663",1.7);
    }
    pen.restore();
  }
  const uniforms=[["#ca6c35","#d99951","#263b48"],["#34404d","#4d5a6a","#242d39"],["#d9773d","#eda35d","#345579"],["#ae5044","#d77a57","#e9a679"]];
  for(let cell=0;cell<4;cell++)for(let back=0;back<2;back++){
    const x=((cell%2)*2+back)*192,y=384+Math.floor(cell/2)*192,c=uniforms[cell];
    pen.save();pen.translate(x,y);pen.beginPath();pen.rect(0,0,192,192);pen.clip();
    const wash=pen.createLinearGradient(0,12,192,166);wash.addColorStop(0,c[0]);wash.addColorStop(.43,c[1]);wash.addColorStop(1,c[0]);
    pen.fillStyle=wash;pen.fillRect(0,0,192,192);
    if(cell!==2&&cell!==0)for(let i=0;i<6;i++){
      const sx=12+i*31;path("M"+sx+" 28 Q"+(sx+12)+" 97 "+(sx-4)+" 175 L"+(sx+1)+" 183 Q"+(sx+19)+" 83 "+sx+" 28Z","#332c3125");
    }
    if(cell===0||cell===2){
      // Cloth bunches at its belt and pulls diagonally towards an armhole.
      const umber=cell===2?"#71402b54":"#70402d43",lit="#ffe2a34b";
      path("M0 47 Q21 58 48 83 Q21 69 4 66Z M192 50 Q169 63 146 92 Q173 72 192 68Z",umber);
      path("M9 162 Q40 142 69 132 Q42 145 28 165Z M176 155 Q138 149 117 157 Q145 154 161 163Z",umber);
      path("M34 183 Q63 160 94 155 Q70 166 59 182Z M115 188 Q139 169 168 166 Q144 174 136 186Z",umber);
      path("M9 157 Q38 141 62 134 M39 178 Q66 160 85 158 M134 178 Q147 171 161 169",null,lit,1.8);
      if(!back){
        path("M13 91 Q31 97 52 102 Q28 101 15 97Z M176 95 Q156 110 130 113 Q154 107 170 95Z","#51314126");
        path("M78 174 Q96 155 115 149 Q101 157 93 170Z","#72482b36");
      }
    }
    if(!back){
      if(cell===0){path("M63 0 Q82 35 91 41 L91 192 L98 192 L98 38 Q78 18 77 0Z",c[2]);path("M92 39 L93 187",null,"#d6b57c",1.5);}
      if(cell===1)path("M52 0 Q91 46 140 7 L141 17 L92 58 L51 15Z",c[2]);
      if(cell===2){
        path("M22 -3 L169 -3 Q153 27 126 62 Q112 83 92 98 Q75 78 63 55 Q36 26 22 -3Z","#263c58");
        path("M36 0 L153 0 Q135 29 109 68 L93 86 Q72 60 57 35Z","#3e5874");
        path("M55 -2 L139 -2 Q124 22 111 37 L94 54 Q72 33 55 -2Z","#e3ad83");
        path("M64 5 Q80 9 92 18 Q108 12 131 4 M80 29 Q90 38 95 41",null,"#a4775b",2);
        path("M22 3 Q62 60 93 98 Q116 77 138 46",null,"#f4bd78",3);
        path("M91 102 Q114 88 128 68",null,"#9153328c",2.4);
      }
      if(cell===3){
        path("M37 -3 L159 -3 L139 194 L58 194Z","#edba8b");
        path("M63 45 Q78 50 90 47 M100 47 Q118 51 133 40",null,"#c18e686e",2.5);
        path("M68 66 Q77 72 89 88 L98 95 L110 112 L122 126 L104 112 L96 101 L84 91Z","#b37d68");
        path("M125 66 L115 83 L105 90 L98 100 L83 115 L73 122 L81 109 L91 98 L98 89 L110 82Z","#bd8971");
        path("M71 67 L89 86 L98 94 M120 74 L108 87",null,"#f7c5a0",1.5);
      }
    }else if(cell===0||cell===2){
      oval(96,77,21,23,cell===0?"#ae5541":"#dec697");path("M95 63 Q114 60 109 75 Q104 88 92 85 Q82 82 88 74 Q94 67 100 73 Q105 79 96 80",null,"#63554a",3.5);
    }
    path("M8 174 Q95 187 183 171",null,"#443e3a66",2);path("M8 177 Q95 190 183 174",null,"#eac3958a",1);
    pen.restore();
  }
  return canvas;
}
