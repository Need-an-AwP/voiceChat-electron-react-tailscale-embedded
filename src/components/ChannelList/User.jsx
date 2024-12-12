import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    ContextMenu,
    ContextMenuCheckboxItem,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuRadioGroup,
    ContextMenuRadioItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Slider } from "@/components/ui/slider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { Mic, MicOff } from "lucide-react"
import { useTailscale } from "@/contexts/TailscaleContext";
import { useDB } from "@/contexts/DBContext"
import { useRTC } from "@/contexts/HttpRtcContext";


const User = ({ user, channelId, self = false, audioActive, gainNode }) => {
    const { selfIPs } = useTailscale();
    const { selfConfig } = useDB();
    const { rtcStates } = useRTC();

    user = {
        ...user,
        avatar: user.ip === selfIPs.ipv4 ?
            selfConfig.user_avatar :
            rtcStates[user.ip]?.userConfig?.user_avatar,
        name: user.ip === selfIPs.ipv4 ?
            selfConfig.user_name :
            rtcStates[user.ip]?.userConfig?.user_name,
    }
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: user.id,
        data: {
            user,
            fromChannelId: channelId
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };


    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    ref={setNodeRef}
                    {...listeners}
                    {...attributes}
                    style={style}
                    className={`
                        flex items-center px-2 py-2 rounded-md cursor-grab active:cursor-grabbing
                        ${self ? 'hover:bg-blue-300/60' : 'hover:bg-secondary/60'}
                        `}
                >
                    <div className="flex items-center gap-2">
                        <Avatar
                            className={`
                                flex-shrink-0 h-8 w-8
                                ${audioActive ? 'border-2 border-green-500' : null}
                            `}
                        >
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>

                        <span className="text-sm line-clamp-1 break-all">{user.name}</span>
                    </div>

                </div>
            </ContextMenuTrigger>
            {self ? (
                <ContextMenuContent className="w-64">
                    <ContextMenuItem>
                        this is you
                    </ContextMenuItem>
                </ContextMenuContent>
            ) : (
                <ContextMenuContent className="w-64">
                    <ContextMenuCheckboxItem>
                        mute this user's output
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuCheckboxItem>
                        mute input for this user
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem>
                        <Mic />
                        <Slider />
                    </ContextMenuItem>

                </ContextMenuContent>
            )}
        </ContextMenu>
    );

};

export default User;