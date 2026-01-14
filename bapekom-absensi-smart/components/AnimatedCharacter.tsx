import React from 'react';

interface AnimatedCharacterProps {
    isPasswordFocused: boolean;
}

const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({ isPasswordFocused }) => {
    return (
        <div className="w-32 h-32 mx-auto mb-6 relative">
            <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Head */}
                <circle cx="100" cy="100" r="80" fill="#FFD93D" stroke="#F6C90E" strokeWidth="3" />

                {/* Left Eye */}
                <g className="transition-all duration-300">
                    {isPasswordFocused ? (
                        // Closed eye (line)
                        <line x1="70" y1="85" x2="90" y2="85" stroke="#2D3748" strokeWidth="4" strokeLinecap="round" />
                    ) : (
                        // Open eye
                        <>
                            <circle cx="80" cy="85" r="12" fill="white" stroke="#2D3748" strokeWidth="2" />
                            <circle cx="80" cy="85" r="6" fill="#2D3748" />
                            <circle cx="82" cy="83" r="2" fill="white" />
                        </>
                    )}
                </g>

                {/* Right Eye */}
                <g className="transition-all duration-300">
                    {isPasswordFocused ? (
                        // Closed eye (line)
                        <line x1="110" y1="85" x2="130" y2="85" stroke="#2D3748" strokeWidth="4" strokeLinecap="round" />
                    ) : (
                        // Open eye
                        <>
                            <circle cx="120" cy="85" r="12" fill="white" stroke="#2D3748" strokeWidth="2" />
                            <circle cx="120" cy="85" r="6" fill="#2D3748" />
                            <circle cx="122" cy="83" r="2" fill="white" />
                        </>
                    )}
                </g>

                {/* Nose */}
                <ellipse cx="100" cy="105" rx="8" ry="12" fill="#F6C90E" />

                {/* Mouth - Happy */}
                <path
                    d="M 75 120 Q 100 135 125 120"
                    fill="none"
                    stroke="#2D3748"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                />

                {/* Blush */}
                <circle cx="60" cy="110" r="8" fill="#FF6B9D" opacity="0.4" />
                <circle cx="140" cy="110" r="8" fill="#FF6B9D" opacity="0.4" />
            </svg>

            {/* Cute animation indicator */}
            {isPasswordFocused && (
                <div className="absolute -top-2 -right-2 animate-bounce">
                    <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                        🙈
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnimatedCharacter;
