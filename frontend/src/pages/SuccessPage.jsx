import { useLocation, useNavigate } from "react-router-dom";

export default function SuccessPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) return <div>No Data</div>;

  const isTopup = state.type === "topup";
  const { sender, receiver, amount, transactionId, provider, accountRef } = state;

  const mask = (acc) =>
    acc.slice(0, 3) + "-xxxx-xx" + acc.slice(-2);

  return (
    <div className="min-h-screen min-h-dvh bg-base-200 p-4 flex items-center justify-center">
      <div className="bg-base-100 rounded-3xl shadow-xl p-6 w-full max-w-md text-center">

        {/* ICON */}
        <div className="text-5xl text-indigo-500 mb-3">✔</div>

        <h2 className="text-lg font-semibold">Transaction Completed</h2>
        <p className="text-sm opacity-60 mb-4">
          {isTopup
            ? "Your top-up was successful"
            : "Your money has been sent successfully"}
        </p>

        {/* AMOUNT */}
        <h1 className="text-3xl font-bold text-indigo-600 mb-4">
          ฿{Number(amount).toLocaleString()}
        </h1>

        <hr className="my-3" />

        {/* FROM */}
        <div className="text-sm text-left space-y-1">
          <p className="opacity-60">From</p>
          <div className="flex justify-between">
            <span>Name</span>
            <span>{sender.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span>Account</span>
            <span>{mask(sender.accountNumber)}</span>
          </div>
        </div>

        <hr className="my-3" />

        {/* TO */}
        <div className="text-sm text-left space-y-1">
          <p className="opacity-60">To</p>
          {isTopup ? (
            <>
              <div className="flex justify-between">
                <span>Service</span>
                <span>{provider}</span>
              </div>
              <div className="flex justify-between">
                <span>Number</span>
                <span>{accountRef}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Name</span>
                <span>{receiver.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span>Account</span>
                <span>{mask(receiver.accountNumber)}</span>
              </div>
            </>
          )}
        </div>

        <hr className="my-3" />

        {/* DETAILS */}
        <div className="text-sm text-left space-y-1">
          <div className="flex justify-between">
            <span>Transaction ID</span>
            <span>{transactionId}</span>
          </div>

          <div className="flex justify-between">
            <span>Date</span>
            <span>{new Date().toLocaleString()}</span>
          </div>

          <div className="flex justify-between">
            <span>Fee</span>
            <span className="text-green-600">0.00 THB</span>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="btn mt-5 w-full bg-indigo-500 text-white rounded-xl"
        >
          Done
        </button>
      </div>
    </div>
  );
}