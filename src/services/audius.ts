export interface AudiusTrack {
  id: string;
  title: string;
  user: { name: string };
  duration: number;
  artwork: { "150x150": string };
  permalink: string;
}

const APP_NAME = "AI_STUDIO_DJ_APP";

export async function searchAudius(query: string): Promise<AudiusTrack[]> {
  if (!query) return [];
  
  try {
    const hostResponse = await fetch('https://api.audius.co');
    const { data: hosts } = await hostResponse.json();
    // Try first 3 hosts in case one is flaky
    for (const host of hosts.slice(0, 3)) {
      try {
        const response = await fetch(`${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP_NAME}`);
        if (!response.ok) continue;
        const data = await response.json();
        return data.data || [];
      } catch (e) {
        continue;
      }
    }
    return [];
  } catch (error) {
    console.error("Audius Search Error:", error);
    return [];
  }
}

export async function getAudiusStreamUrl(trackId: string): Promise<string> {
  try {
    const hostResponse = await fetch('https://api.audius.co');
    const { data: hosts } = await hostResponse.json();
    
    // Try multiple hosts
    for (const host of hosts.slice(0, 3)) {
      try {
        // We use the redirect=false flag to get the actual CID URL which is often more stable for Tone.js
        const streamInfo = await fetch(`${host}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}&redirect=false`);
        if (streamInfo.ok) {
          const { data } = await streamInfo.json();
          if (data) return data;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Fallback to a simple redirecting URL if all else fails
    const fallbackHost = hosts[0] || 'https://discoveryprovider.audius.co';
    return `${fallbackHost}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`;
  } catch (error) {
    console.error("Audius Stream Error:", error);
    return "";
  }
}
