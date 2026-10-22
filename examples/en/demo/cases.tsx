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
    label: "Counter",
    create() {
      const counter = Behavon.createModel(Counter, 0);
      return { element: <CounterView counter={counter} />, dispose: () => counter.dispose() };
    },
  },
  {
    id: "todo-list",
    label: "Todo list",
    create() {
      const todos = createTodoList(["Buy milk", "Return a book"]);
      return { element: <TodoView app={todos.app} />, dispose: todos.dispose };
    },
  },
  {
    id: "team-board",
    label: "Team board",
    create() {
      const team = createTeamBoard({
        members: [{ id: "kim", name: "Kim" }, { id: "lee", name: "Lee" }],
        transport: createFakeTransport().transport,
      });
      return { element: <BoardView board={team.board} />, dispose: team.dispose };
    },
  },
  {
    id: "search",
    label: "Search",
    create() {
      const search = Behavon.createModel(Search, searchApi);
      return { element: <SearchView search={search} />, dispose: () => search.dispose() };
    },
  },
  {
    id: "upload-queue",
    label: "Upload queue",
    create() {
      const queue = Behavon.createModel(UploadQueue, uploadApi);
      return { element: <UploadQueueView queue={queue} />, dispose: () => queue.dispose() };
    },
  },
  {
    id: "db-session",
    label: "DB session",
    create() {
      const report = Behavon.createModel(OrdersReport, { url: "demo://shop", driver: databaseDriver });
      return { element: <OrdersReportView report={report} />, dispose: () => report.dispose() };
    },
  },
  {
    id: "quote-request",
    label: "Quote request",
    create() {
      const quotes = createQuoteRequest([
        { name: "Ganada", priceOf: priceSource(400, 120, "screw") },
        { name: "Dara", priceOf: priceSource(900, 110, "bolt") },
        { name: "Maba", priceOf: priceSource(1_500, 100, "washer") },
      ]);
      return { element: <QuoteView board={quotes.board} />, dispose: quotes.dispose };
    },
  },
  {
    id: "bank-transfer",
    label: "Bank transfer",
    create() {
      const bank = createBank({
        accounts: { kim: { name: "Kim", balance: 10_000 }, lee: { name: "Lee", balance: 3_000 }, bank: { name: "Fees", balance: 0 } },
        feeAccount: "bank",
        fee: 500,
      });
      return { element: <BankView bank={bank.bank} accounts={bank.accounts} />, dispose: bank.dispose };
    },
  },
  {
    id: "market-simulation",
    label: "Market simulation",
    create() {
      const simulation = createSimulation(defaultScenario);
      return { element: <MarketView clock={simulation.clock} views={simulation.views} />, dispose: simulation.dispose };
    },
  },
];
