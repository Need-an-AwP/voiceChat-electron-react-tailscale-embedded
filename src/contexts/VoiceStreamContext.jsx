import { createContext, useContext, useEffect, useRef } from "react";
import { useRTC } from "./HttpRtcContext";
import { useTailscale } from "./TailscaleContext";
import { useAudio } from "./AudioContext";


const VoiceStreamContext = createContext({});

export function VoiceStreamProvider({ children }) {
    const { selfIPs } = useTailscale();
    const { RTCs, receivedStream, receivedVideoStream, inVoiceChannel } = useRTC();
    const { finalStream, selfAudioActive } = useAudio();

    const audioContextsRef = useRef({});
    const audioElementsRef = useRef({});
    const audioActiveRef = useRef({});
    const animationFramesRef = useRef({});
    const gainNodesRef = useRef({});

    useEffect(() => {
        const currentChannel = inVoiceChannel[selfIPs.ipv4];
        if (!currentChannel) return;
        
        Object.entries(inVoiceChannel).filter(([address, peerChannel]) =>
            peerChannel.id === currentChannel.id
            && peerChannel.name === currentChannel.name
            && address !== selfIPs.ipv4// exclude self
        )
            .forEach(async ([ip, peer]) => {
                const rtc = RTCs.current[ip];
                if (!rtc) return;
                if (!rtc.trackHasAudio) {
                    rtc.replaceAudioTrack(finalStream);
                }

                const voiceStream = receivedStream[ip];

                if (voiceStream) {
                    if (!audioContextsRef.current[ip]) {
                        audioContextsRef.current[ip] = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    const ctx = audioContextsRef.current[ip];
                    if (ctx.state === 'suspended') {
                        await ctx.resume();
                    }
                    const sourceNode = ctx.createMediaStreamSource(voiceStream);
                    const gainNode = ctx.createGain();
                    const analyser = ctx.createAnalyser();
                    gainNode.gain.value = 1
                    const destination = ctx.createMediaStreamDestination();
                    sourceNode.connect(gainNode);
                    gainNode.connect(destination);
                    gainNodesRef.current[ip] = gainNode

                    const silentAudio = new Audio();
                    silentAudio.srcObject = voiceStream;//origin stream spoofing for ctx can get vaild stream
                    silentAudio.volume = 0;
                    silentAudio.play().catch(e => console.log('spoofed audio play failed:', e));

                    if (!audioElementsRef.current[ip]) {
                        const audioEl = new Audio()
                        audioElementsRef.current[ip] = audioEl
                    }
                    audioElementsRef.current[ip].srcObject = destination.stream
                    audioElementsRef.current[ip].play()

                    analyser.fftSize = 256;
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    sourceNode.connect(analyser);

                    const checkAudioLevel = () => {
                        analyser.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((acc, value) => acc + value, 0) / bufferLength;
                        audioActiveRef.current[ip] = average > 6;
                        animationFramesRef.current[ip] = requestAnimationFrame(checkAudioLevel);
                    };
                    checkAudioLevel();

                }
            })
    }, [inVoiceChannel]);


    const value = {
        audioActiveRef,
        gainNodesRef,
    }

    return (
        <VoiceStreamContext.Provider value={value}>
            {children}
        </VoiceStreamContext.Provider>
    )
}

export function useVoiceStream() {
    const voiceStream = useContext(VoiceStreamContext)
    if (!voiceStream) {
        throw new Error('useVoiceStream must be used within a VoiceStreamProvider')
    }
    return voiceStream;
}
