export function calculateCer(reference,hypothesis) {
  const normalize=value=>[...value.normalize('NFC')].filter(char=>/[\p{L}\p{N}]/u.test(char));
  const ref=normalize(reference),hyp=normalize(hypothesis);
  const grid=Array.from({length:ref.length+1},()=>Array.from({length:hyp.length+1},()=>({s:0,d:0,i:0})));
  for(let i=1;i<=ref.length;i++)grid[i][0]={s:0,d:i,i:0};
  for(let j=1;j<=hyp.length;j++)grid[0][j]={s:0,d:0,i:j};
  const cost=item=>item.s+item.d+item.i;
  for(let row=1;row<=ref.length;row++)for(let column=1;column<=hyp.length;column++) {
    if(ref[row-1]===hyp[column-1])grid[row][column]=grid[row-1][column-1];
    else {const diagonal=grid[row-1][column-1],above=grid[row-1][column],left=grid[row][column-1];grid[row][column]=[{...diagonal,s:diagonal.s+1},{...above,d:above.d+1},{...left,i:left.i+1}].sort((a,b)=>cost(a)-cost(b))[0];}
  }
  const counts=grid[ref.length][hyp.length];return {...counts,n:ref.length,cer:ref.length?cost(counts)/ref.length:null};
}
