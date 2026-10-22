import Behavon, { type Model, type Signal, type Slot, type SnapshotRootId, type TypedModelRef } from "behavon";

export interface Member {
  readonly id: string;
  readonly name: string;
}

export interface MembersView {
  readonly members: readonly Member[];
  readonly selectedId: string | undefined;
}

/** Where Members sends the member that was just selected. */
export interface MemberListener {
  memberSelected: Slot<[member: Member]>;
}

export interface MembersPort {
  view: SnapshotRootId<MembersView>;
  select: Signal<[memberId: string]>;
  /** Sent with the member that was just selected. */
  selected: Signal<[member: Member]>;
}

const membersPort = Behavon.createPort<MembersPort>({
  view: Behavon.SnapshotType(),
  select: Behavon.SignalType(),
  selected: Behavon.SignalType(),
});

export interface MembersInput {
  readonly members: readonly Member[];
  readonly listener: TypedModelRef<MemberListener>;
}

/** Holds the team members and which one is selected. */
export const Members: Model<MembersInput, string | undefined, MembersPort> = (input) => {
  const { members } = input;
  const viewId = Behavon.useExport(membersPort, "view");
  const [selectedId, setSelectedId] = Behavon.useState<string>();
  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ members, selectedId });
  }, [members, publish, selectedId]);

  const selectedBody = Behavon.useCallback((_member: Member) => undefined, []);
  const selected = Behavon.useSignal(membersPort, "selected", selectedBody);
  Behavon.useExport(membersPort, "selected");
  const listener = Behavon.usePort(input.listener);
  Behavon.useConnect(selected, listener.memberSelected);

  const select = Behavon.useCallback((memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    if (member === undefined) return;
    setSelectedId(member.id);
    selected(member);
  }, [members, selected, setSelectedId]);
  Behavon.useSignal(membersPort, "select", select);
  Behavon.useExport(membersPort, "select");

  return selectedId;
};
