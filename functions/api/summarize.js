// functions/api/summarize.ts
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { text } = await request.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Access Gemini API key via Cloudflare Environment variables
    const apiKey = env.GEMINI_API_KEY;
    
    // Call Gemini API directly via HTTP fetch on the Edge
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an assistant that summarizes user thoughts and voice notes. Keep the summary punchy, concise, friendly, and limited to 2-3 sentences. Focus on capturing the key points, actions, or takeaways.\n\nVoice Note:\n"${text}"`
                }
              ]
            }
          ]
        }),
      }
    );

    const data = await response.json();
    const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";

    return new Response(JSON.stringify({ summary: summaryText }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
