import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";

const CONNECT_SOURCE = require("../assets/sounds/model-picker-connect.wav");
const DISCONNECT_SOURCE = require("../assets/sounds/model-picker-disconnect.wav");

let audioReady = false;
let connectPlayer: AudioPlayer | null = null;
let disconnectPlayer: AudioPlayer | null = null;

async function ensureModelPickerAudio(): Promise<void> {
  if (audioReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    shouldPlayInBackground: false,
  });
  connectPlayer = createAudioPlayer(CONNECT_SOURCE);
  disconnectPlayer = createAudioPlayer(DISCONNECT_SOURCE);
  audioReady = true;
}

async function playClip(player: AudioPlayer | null): Promise<void> {
  if (!player) return;
  player.seekTo(0);
  player.play();
}

/** Ascending chime when a model is loaded into memory. */
export async function playModelLoadSound(): Promise<void> {
  try {
    await ensureModelPickerAudio();
    await playClip(connectPlayer);
  } catch {
    /* UI sound — ignore playback failures */
  }
}

/** Descending chime when a model is ejected / unloaded. */
export async function playModelUnloadSound(): Promise<void> {
  try {
    await ensureModelPickerAudio();
    await playClip(disconnectPlayer);
  } catch {
    /* UI sound — ignore playback failures */
  }
}
