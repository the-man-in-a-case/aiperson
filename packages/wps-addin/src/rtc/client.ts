import VERTC, {
  type IRTCEngine,
  MediaType,
} from "@volcengine/rtc";

export interface RtcJoinArgs {
  appId: string;
  token: string;
  roomId: string;
  userId: string;
  avatarUserId: string;
  remoteVideoEl: HTMLDivElement;
  onAgentSpeaking?: (speaking: boolean) => void;
  onError?: (msg: string) => void;
}

export interface RtcSession {
  leave: () => Promise<void>;
  toggleMic: (on: boolean) => Promise<void>;
  isMicOn: () => boolean;
}

export async function joinAvatarRoom(args: RtcJoinArgs): Promise<RtcSession> {
  const engine: IRTCEngine = VERTC.createEngine(args.appId);
  let micOn = false;

  engine.on(VERTC.events.onUserPublishStream, async (e) => {
    if (e.userId !== args.avatarUserId) return;
    try {
      await engine.subscribeStream(e.userId, e.mediaType);
      if (e.mediaType === MediaType.VIDEO || e.mediaType === MediaType.AUDIO_AND_VIDEO) {
        await engine.setRemoteVideoPlayer(0 as any, {
          userId: e.userId,
          renderDom: args.remoteVideoEl,
        });
      }
    } catch (err) {
      args.onError?.(err instanceof Error ? err.message : String(err));
    }
  });

  engine.on(VERTC.events.onUserUnpublishStream, () => {
    args.onAgentSpeaking?.(false);
  });

  engine.on(VERTC.events.onError as any, (err: any) => {
    args.onError?.(`RTC error: ${err?.errorCode ?? err}`);
  });

  await engine.joinRoom(
    args.token,
    args.roomId,
    { userId: args.userId },
    {
      isAutoPublish: true,
      isAutoSubscribeAudio: true,
      isAutoSubscribeVideo: true,
    } as any,
  );

  const toggleMic = async (on: boolean): Promise<void> => {
    if (on && !micOn) {
      await engine.startAudioCapture();
      await engine.publishStream(MediaType.AUDIO);
      micOn = true;
    } else if (!on && micOn) {
      await engine.unpublishStream(MediaType.AUDIO);
      await engine.stopAudioCapture();
      micOn = false;
    }
  };

  const leave = async (): Promise<void> => {
    try {
      if (micOn) await toggleMic(false);
      await engine.leaveRoom();
    } finally {
      VERTC.destroyEngine(engine);
    }
  };

  return { leave, toggleMic, isMicOn: () => micOn };
}
