'use client'

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="relative w-20 h-20">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 border-4 border-[#F59E0B]/20 rounded-full"></div>
        
        {/* Animated gradient ring */}
        <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin-slow"
          style={{
            borderTopColor: '#F59E0B',
            borderRightColor: '#D97706',
            borderBottomColor: '#F59E0B',
            borderLeftColor: 'transparent',
          }}
        ></div>
        
        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-[#F59E0B] rounded-full animate-pulse-custom shadow-lg shadow-[#F59E0B]/50"></div>
        </div>
        
        {/* Glowing effect */}
        <div className="absolute inset-0 rounded-full bg-[#F59E0B]/10 animate-ping"></div>
      </div>
    </div>
  )
}
