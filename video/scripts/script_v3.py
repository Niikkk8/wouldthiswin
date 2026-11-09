"""The launch video's script, v3. One place for what's said, what's captioned, and how it's
directed. voice_cb.py speaks it, voice_words.py times it, plan_v2.py places it.

  text    the caption, exactly (lowercase, like the app)
  spoken  what the model is given: sentence case and punctuation are the direction
          ("..." is a held beat, "?" lifts, "!" punches)
  ex      Chatterbox exaggeration: 0.5 is neutral, higher is more emotional
  cfg     Chatterbox cfg weight: lower is looser, faster, more conversational
  note    the read we're after (for the humans)
"""

LINES = {
    "1": {
        "text": "hackathon project due tonight?",
        "spoken": "Hackathon project due tonight?",
        "ex": 0.72, "cfg": 0.4,
        "note": "a friend leaning in. names the situation in the first second",
    },
    "2": {
        "text": "would this win?",
        "spoken": "Would this win?",
        "ex": 0.8, "cfg": 0.35,
        "note": "the question everyone's actually asking. a lift on 'win'",
    },
    "3": {
        "text": "paste your repo.",
        "spoken": "Paste your repo.",
        "ex": 0.68, "cfg": 0.4,
        "note": "easy, quick, it's one step",
    },
    "4": {
        "text": "it checks your readme against your actual code.",
        "spoken": "It checks your read-me... against your actual code.",
        "ex": 0.68, "cfg": 0.4,
        "note": "a little conspiratorial on 'actual code'",
    },
    "5": {
        "text": "promised something you didn't build? your odds drop.",
        "spoken": "Promised something you didn't build? Your odds drop.",
        "ex": 0.75, "cfg": 0.35,
        "note": "a raised eyebrow, then the drop is blunt",
    },
    "6": {
        "text": "then three judges grill you.",
        "spoken": "Then three judges grill you.",
        "ex": 0.7, "cfg": 0.4,
        "note": "relish 'grill'",
    },
    "6a": {
        "text": "the engineer wants proof.",
        "spoken": "The engineer wants proof.",
        "ex": 0.68, "cfg": 0.4,
        "note": "dry",
    },
    "6b": {
        "text": "the investor wants to know who's paying.",
        "spoken": "The investor wants to know who's paying.",
        "ex": 0.68, "cfg": 0.4,
        "note": "a smirk",
    },
    "6c": {
        "text": "and the tired judge has seen forty demos today. one sentence. go.",
        "spoken": "And the tired judge... has seen forty demos today. One sentence. Go.",
        "ex": 0.8, "cfg": 0.3,
        "note": "the joke: a beat after 'tired judge', sympathetic on 'forty demos', snappy on 'go'",
    },
    "7": {
        "text": "then they talk about you. right in front of you.",
        "spoken": "Then they talk about you. Right in front of you.",
        "ex": 0.7, "cfg": 0.35,
        "note": "mock-scandalised on the second sentence",
    },
    "8": {
        "text": "and tell you exactly what to fix.",
        "spoken": "And tell you exactly what to fix.",
        "ex": 0.68, "cfg": 0.4,
        "note": "warm, helpful, landing",
    },
    "9": {
        "text": "would yours win? try it free at wouldthiswin dot com.",
        "spoken": "Would yours win? Try it free, at would-this-win dot com.",
        "ex": 0.7, "cfg": 0.4,
        "note": "a challenge, then an easy invitation",
    },
}
