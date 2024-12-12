
import { useRTC } from "@/contexts/HttpRtcContext";
import { useTailscale } from "@/contexts/TailscaleContext";

const VoiceMembers = () => {
    const { selfIPs } = useTailscale();
    const { users, inVoiceChannel } = useRTC();

    const voiceMembers = users[inVoiceChannel[selfIPs.ipv4]?.id] || [];
    return (
        <div className="w-full h-full">
            <div className="flex flex-col gap-2 mt-16">
                {voiceMembers.map(member => (
                    <div
                        key={member.id}
                        className="w-full rounded-lg border-2 "
                    >
                        {member.name}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default VoiceMembers