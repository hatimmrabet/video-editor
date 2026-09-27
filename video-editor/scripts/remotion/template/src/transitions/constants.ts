/* How things enter and leave the screen. Written once: scenes and captions both read these. */

export type Rise = {duration: number; easing: string; y: number; scale: boolean};

/* A scene or a caption arriving: it fades in while rising, with a small pop. */
export const SCENE_ENTER: Rise = {duration: 0.20, easing: 'EASE_OUT', y: 28, scale: true};

/* ...and leaving: it fades out while lifting away. */
export const SCENE_EXIT: Rise = {duration: 0.13, easing: 'LINEAR', y: -10, scale: false};

/* The end card sliding up over the video. */
export const OUTRO = {duration: 0.45, easing: 'EASE_IN_OUT'};
