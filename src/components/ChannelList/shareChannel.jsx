import { LucideMessageCircle, LucideSettings, Airplay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from '@/lib/utils';
import User from './User';


export default function ShareChannel({ channel, users, inShareChannel, setInShareChannel, joinShareChannel, disabled = false }) {
    
    
    return (
        <div
            className={cn(
                "space-y-1 w-full rounded-md bg-secondary/30 cursor-pointer hover:bg-secondary/10",
                // dropIsOver && "bg-secondary/80",
                disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            onDoubleClick={() => {
                if (disabled) return;
                joinShareChannel(channel)
            }}
        >
            <div className="flex items-center justify-between p-2 px-4 w-full">
                <div className="flex items-center gap-4 w-full">
                    <Airplay className="w-4 h-4" />
                    <p className="line-clamp-1 text-sm">{channel.name}</p>
                </div>
                <div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className='cursor-pointer hover:'>
                                <LucideSettings className="w-4 h-4" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 m-8 ml-0 z-50 overflow-hidden" >
                            <div className="space-y-2">
                                <p>Channel Settings</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="pl-4 rounded-md transition-colors duration-200">
                {users?.map((user) => {
                    return <User user={user} />
                })}
            </div>
        </div>
    )
}
