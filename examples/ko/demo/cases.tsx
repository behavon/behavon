import type { ReactElement } from "react";
import Behavon from "behavon";
import { BankView } from "../bank-transfer/bank-view";
import { createBank } from "../bank-transfer/bank";
import { Counter } from "../counter/counter";
import { CounterView } from "../counter/counter-view";
import { OrdersReport } from "../db-session/orders-report";
import { OrdersReportView } from "../db-session/orders-report-view";
import { MarketView } from "../market-simulation/market-view";
import { defaultScenario } from "../market-simulation/scenario";
import { createSimulation } from "../market-simulation/simulation";
import { createQuoteRequest } from "../quote-request/quote-board";
import { QuoteView } from "../quote-request/quote-view";
import { Search } from "../search/search";
import { SearchView } from "../search/search-view";
import { createTeamBoard } from "../team-board/board";
import { BoardView } from "../team-board/board-view";
import { createFakeTransport } from "../team-board/fake-transport";
import { createTodoList } from "../todo-list/todo-app";
import { TodoView } from "../todo-list/todo-view";
import { UploadQueue } from "../upload-queue/upload-queue";
import { UploadQueueView } from "../upload-queue/upload-queue-view";
import { databaseDriver, priceSource, searchApi, uploadApi } from "./browser-services";

/** A running case: the screen to render and how to release its Models. */
export interface DemoInstance {
  readonly element: ReactElement;
  dispose(): void;
}

export interface DemoCase {
  readonly id: string;
  readonly label: string;
  create(): DemoInstance;
}

export const demoCases: readonly DemoCase[] = [
  {
    id: "counter",
    label: "카운터",
    create() {
      const counter = Behavon.createModel(Counter, 0);
      return { element: <CounterView counter={counter} />, dispose: () => counter.dispose() };
    },
  },
  {
    id: "todo-list",
    label: "할 일 목록",
    create() {
      const todos = createTodoList(["우유 사기", "책 반납"]);
      return { element: <TodoView app={todos.app} />, dispose: todos.dispose };
    },
  },
  {
    id: "team-board",
    label: "팀 보드",
    create() {
      const team = createTeamBoard({
        members: [{ id: "kim", name: "김" }, { id: "lee", name: "이" }],
        transport: createFakeTransport().transport,
      });
      return { element: <BoardView board={team.board} />, dispose: team.dispose };
    },
  },
  {
    id: "search",
    label: "검색",
    create() {
      const search = Behavon.createModel(Search, searchApi);
      return { element: <SearchView search={search} />, dispose: () => search.dispose() };
    },
  },
  {
    id: "upload-queue",
    label: "업로드 대기열",
    create() {
      const queue = Behavon.createModel(UploadQueue, uploadApi);
      return { element: <UploadQueueView queue={queue} />, dispose: () => queue.dispose() };
    },
  },
  {
    id: "db-session",
    label: "DB 세션",
    create() {
      const report = Behavon.createModel(OrdersReport, { url: "demo://shop", driver: databaseDriver });
      return { element: <OrdersReportView report={report} />, dispose: () => report.dispose() };
    },
  },
  {
    id: "quote-request",
    label: "견적 요청",
    create() {
      const quotes = createQuoteRequest([
        { name: "가나상사", priceOf: priceSource(400, 120, "나사") },
        { name: "다라유통", priceOf: priceSource(900, 110, "볼트") },
        { name: "마바물산", priceOf: priceSource(1_500, 100, "와셔") },
      ]);
      return { element: <QuoteView board={quotes.board} />, dispose: quotes.dispose };
    },
  },
  {
    id: "bank-transfer",
    label: "계좌 이체",
    create() {
      const bank = createBank({
        accounts: { kim: { name: "김", balance: 10_000 }, lee: { name: "이", balance: 3_000 }, bank: { name: "수수료", balance: 0 } },
        feeAccount: "bank",
        fee: 500,
      });
      return { element: <BankView bank={bank.bank} accounts={bank.accounts} />, dispose: bank.dispose };
    },
  },
  {
    id: "market-simulation",
    label: "거래소 시뮬레이션",
    create() {
      const simulation = createSimulation(defaultScenario);
      return { element: <MarketView clock={simulation.clock} views={simulation.views} />, dispose: simulation.dispose };
    },
  },
];
