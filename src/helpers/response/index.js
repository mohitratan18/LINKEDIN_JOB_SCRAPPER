const response = ({req,res,message,data,status,success})=>{
    return res.status(status).json({message,data,success})
}

module.exports = {response}