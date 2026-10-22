// Pitido y vibración al escanear, para que la taquilla no tenga que mirar la pantalla
let ctx: AudioContext | null = null;

function tono(frecuencia: number, inicio: number, duracion: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = frecuencia;
  o.type = 'sine';
  g.gain.setValueAtTime(0.25, ctx.currentTime + inicio);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + inicio);
  o.stop(ctx.currentTime + inicio + duracion);
}

export function avisar(ok: boolean) {
  try {
    ctx ??= new AudioContext();
    if (ok) {
      tono(880, 0, 0.15);
    } else {
      tono(220, 0, 0.25);
      tono(220, 0.3, 0.25);
    }
  } catch {
    /* sin sonido */
  }
  navigator.vibrate?.(ok ? 80 : [200, 100, 200]);
}
