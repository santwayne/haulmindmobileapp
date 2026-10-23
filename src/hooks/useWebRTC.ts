import { useRef } from "react";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices
} from "react-native-webrtc";
import socketService from "../services/socket/socketService";

export const useRNWebRTC = () => {
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);

  const createPeer = (to: string) => {
    const pc: any = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    console.log("🧠 Peer created");

    // 🔊 Remote stream (RN uses onaddstream sometimes)
    pc.onaddstream = (event: any) => {
      console.log("🎧 Remote stream received");
    };

    // 🧊 ICE
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log("🧊 Sending ICE");

        socketService.sendIceCandidate({
          to,
          candidate: event.candidate
        });
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // 📲 ACCEPT CALL
  const handleIncomingCall = async (offer: any, from: string) => {
    try {
      const pc = createPeer(from);

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      localStreamRef.current = stream;

      stream.getTracks().forEach((track: any) => {
        pc.addTrack(track, stream);
      });

      console.log("📡 Setting remote offer");

      await pc.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📡 Sending answer");

      socketService.answerCall({
        to: from,
        answer
      });
    } catch (err) {
      console.error("❌ Incoming call error:", err);
    }
  };

  // 🤝 HANDLE ANSWER
  const handleAnswer = async (answer: any) => {
    try {
      if (!pcRef.current) return;

      console.log("📡 Received answer");

      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (err) {
      console.error("❌ Answer error:", err);
    }
  };

  // 🧊 HANDLE ICE
  const handleICE = async (candidate: any) => {
    try {
      if (!pcRef.current) return;

      console.log("🧊 Received ICE");

      await pcRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (err) {
      console.error("❌ ICE error:", err);
    }
  };

  // 🔚 END CALL
  const endCall = () => {
    console.log("📴 Ending call");

    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    localStreamRef.current = null;
  };

  return {
    handleIncomingCall,
    handleAnswer,
    handleICE,
    endCall
  };
};