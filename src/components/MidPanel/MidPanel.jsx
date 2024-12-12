import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useRTC } from "@/contexts/HttpRtcContext"
import { useTailscale } from "@/contexts/TailscaleContext"
import { ChevronLeft, ChevronRight } from "lucide-react"
// import ScreenShare from "./ScreenShare"
// import VoiceMembers from "./VoiceMembers"

const ScreenShare = lazy(() => import('./ScreenShare'));
const VoiceMembers = lazy(() => import('./VoiceMembers'));

const MidPanel = ({ toggleCollapse }) => {
    const { inVoiceChannel, inScreenShare, setInScreenShare } = useRTC();
    const { selfIPs } = useTailscale();
    const [activeTab, setActiveTab] = useState('voice');
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [firstCollapsed, setFirstCollapsed] = useState(false);

    useEffect(() => {
        if (inScreenShare[selfIPs.ipv4]) {
            setActiveTab('screen share');
        }
    }, [inScreenShare]);

    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#121212] bg-opacity-50 backdrop-blur-sm">


            {inVoiceChannel[selfIPs.ipv4] && (
                <>
                    {/* tabs */}
                    <div className="absolute top-0 left-0 w-full flex flex-row justify-end pr-4 gap-1 z-50">

                        <div
                            className={`
                                    flex items-center justify-center px-4 py-0.5 bg-neutral-800 rounded-b-lg
                                    transition-all hover:bg-neutral-700 focus:outline-none cursor-pointer
                                    ${activeTab === 'voice' ? 'bg-neutral-700 h-10' : 'h-8'}
                                `}
                            onClick={() => setActiveTab('voice')}
                        >
                            <span className="text-sm text-gray-300">Voice</span>
                        </div>

                        <div
                            className={`
                                    flex items-center justify-center px-4 py-0.5 bg-neutral-800 rounded-b-lg
                                    transition-all hover:bg-neutral-700 focus:outline-none cursor-pointer
                                    ${activeTab === 'screen share' ? 'bg-neutral-700 h-10' : 'h-8'}
                                `}
                            onClick={() => {
                                setActiveTab('screen share')
                                if (!firstCollapsed) {
                                    toggleCollapse('right', 'collapse');
                                    setFirstCollapsed(true);
                                }
                                if (!inScreenShare[selfIPs.ipv4]) {
                                    setInScreenShare(prev => ({
                                        ...prev,
                                        [selfIPs.ipv4]: true
                                    }))
                                }
                            }}
                        >
                            <span className="text-sm text-gray-300">Screen Share</span>
                        </div>

                        <div
                            className={`
                                flex items-center justify-center px-4 py-0.5 bg-neutral-800 rounded-b-full
                                transition-all hover:bg-neutral-700 focus:outline-none cursor-pointer h-8
                            `}
                            onClick={() => {
                                toggleCollapse('right', isLeftCollapsed ? 'expand' : 'collapse');
                                setIsLeftCollapsed(!isLeftCollapsed);
                            }}
                        >
                            <span className="text-sm text-gray-300">
                                {isLeftCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                        </div>
                    </div>
                    <Suspense fallback={
                        <div className="h-full w-full flex items-center justify-center">
                            Loading...
                        </div>
                    }>
                        <div className={`h-full w-full flex items-center justify-center ${activeTab === 'voice' ? 'block' : 'hidden'}`}>
                            <VoiceMembers />
                        </div>
                        <div className={`h-full w-full max-h-[80%] flex items-center justify-center ${activeTab === 'screen share' ? 'block' : 'hidden'}`}>
                            <ScreenShare />
                        </div>
                    </Suspense>

                </>
            )}
        </div >
    )
}

export default MidPanel