// Server side of "only one stage speaks": stage pages connect with `?role=stage`; the most recently
// connected one is the speaker. When it closes, the previous one takes over. Works with any
// transport that can send a notification to one client and to all clients.
//
//   const election = createSpeakerElection({ broadcast: (method, params) => hub.notify(method, params) });
//   onConnect:    if (client.query.get('role') === 'stage') election.join(client.id, (m, p) => client.send(m, p));
//   onDisconnect: election.leave(client.id);
export function createSpeakerElection({ broadcast }) {
  let stages = [];
  const announce = () => broadcast('stage.speaker', { speakerId: stages[stages.length - 1] ?? null, stages: stages.length });
  return {
    join(clientId, send) {
      stages = [...stages.filter((id) => id !== clientId), clientId];
      send('stage.hello', { clientId });
      announce();
    },
    leave(clientId) {
      if (!stages.includes(clientId)) return;
      stages = stages.filter((id) => id !== clientId);
      announce();
    },
    speakerId: () => stages[stages.length - 1] ?? null,
    count: () => stages.length,
    /** Send the current speaker to a client that just connected (dashboards show the stage count). */
    describe: () => ({ speakerId: stages[stages.length - 1] ?? null, stages: stages.length })
  };
}
