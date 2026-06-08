const STATUS_ROLE_MAP = {
  receiver_accepted: "receiver",
  receiver_declined: "receiver",
  self_collect: "receiver",
  received: "receiver",
  ask_ngo: "receiver",
  reached: "donor",
  ngo_accepted: "ngo",
  picked_up: "ngo",
  on_the_way: "ngo",
  ngo_delivered: "ngo"
};

function getRequiredRoleForStatus(status) {
  return STATUS_ROLE_MAP[status] || null;
}

module.exports = { STATUS_ROLE_MAP, getRequiredRoleForStatus };
